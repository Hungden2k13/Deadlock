import { io } from "socket.io-client";
import * as THREE from 'three';

export class Network {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.remotePlayers = {};
        this.tickRate = 50; // Gửi vị trí 20 lần/giây (50ms)
        this.lastTick = 0;
    }

    connect() {
        // Tự động lấy URL hiện tại (localhost khi dev, domain khi deploy)
        const serverUrl = window.location.origin;
        const token = localStorage.getItem('deadlock_token');
        
        console.log(`[DEADLOCK] Đang kết nối tới Server: ${serverUrl}`);
        
        // Khởi tạo Socket với Token xác thực
        this.socket = io(serverUrl, { 
            auth: { token },
            transports: ['websocket', 'polling'] // Ưu tiên websocket để giảm độ trễ
        });

        this.socket.on('connect', () => {
            console.log('✅ Đã kết nối Server Multiplayer thành công!');
        });

        this.socket.on('connect_error', (err) => {
            console.error('❌ Lỗi kết nối Server:', err.message);
            if (err.message === 'Unauthorized') {
                alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!');
                localStorage.removeItem('deadlock_token');
                window.location.reload();
            }
        });

        // Nhận danh sách người chơi hiện có khi mới vào
        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                if (id !== this.socket.id) this.addRemotePlayer(players[id]);
            });
        });

        // Có người chơi mới vào
        this.socket.on('newPlayer', (playerInfo) => {
            this.addRemotePlayer(playerInfo);
        });

        // Người chơi khác di chuyển
        this.socket.on('playerMoved', (playerInfo) => {
            const p = this.remotePlayers[playerInfo.id];
            if (p) {
                p.targetPos.set(playerInfo.x, playerInfo.y, playerInfo.z);
                p.targetYaw = playerInfo.yaw;
                p.targetPitch = playerInfo.pitch;
                p.isCrouching = playerInfo.crouch;
                p.isSprinting = playerInfo.sprint;
                p.isAlive = playerInfo.alive;
            }
        });

        // Người chơi khác thoát
        this.socket.on('playerDisconnected', (id) => {
            const p = this.remotePlayers[id];
            if (p) {
                this.game.renderer.scene.remove(p.model.root);
                delete this.remotePlayers[id];
            }
        });
    }

    createNameTag(name, isBot) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256; canvas.height = 64;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = isBot ? '#ff4444' : '#44aaff';
        ctx.font = 'bold 28px Rajdhani, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        
        sprite.scale.set(2.5, 0.6, 1);
        sprite.position.y = 2.2;
        sprite.renderOrder = 999;
        return sprite;
    }

    addRemotePlayer(info) {
        // 1. Tạo mô hình 3D lính
        const model = this.game.charTemplate.instance(info.team || 0);
        model.root.position.set(info.x, info.y, info.z);
        this.game.renderer.scene.add(model.root);

        // 2. Tạo thẻ tên (Name Tag)
        const playerName = info.name || `PLAYER_${info.id.substring(0, 4)}`;
        const nameTag = this.createNameTag(playerName, false);
        model.root.add(nameTag);

        // 3. Tạo đối tượng giả lập để Character.js có thể chạy Animation
        const fakeBot = {
            position: new THREE.Vector3(info.x, info.y, info.z),
            velocity: new THREE.Vector3(),
            yaw: info.yaw || 0,
            pitch: info.pitch || 0,
            alive: true,
            jumpY: 0,
            crouch: 0,
            weapon: { id: 'm4', stats: this.game.currentWeapon?.stats || {} }
        };

        // Gắn súng vào tay
        if (this.game.charTemplate) {
            model.attachWeapon(fakeBot);
        }

        // 4. Lưu vào danh sách quản lý
        this.remotePlayers[info.id] = {
            model: model,
            bot: fakeBot,
            targetPos: new THREE.Vector3(info.x, info.y, info.z),
            targetYaw: info.yaw || 0,
            targetPitch: info.pitch || 0,
            isCrouching: false,
            isSprinting: false,
            isAlive: true
        };
    }

    update(dt) {
        if (!this.socket) return;

        // --- 1. CẬP NHẬT MƯỢT MÀ (Nội suy) CHO NGƯỜI CHƠI KHÁC ---
        for (const id in this.remotePlayers) {
            const rp = this.remotePlayers[id];
            
            // Nội suy vị trí (Lerp) để không bị giật lag
            rp.bot.position.lerp(rp.targetPos, 15 * dt);
            
            // Nội suy góc xoay
            rp.bot.yaw = THREE.MathUtils.lerp(rp.bot.yaw, rp.targetYaw, 15 * dt);
            rp.bot.pitch = THREE.MathUtils.lerp(rp.bot.pitch, rp.targetPitch, 15 * dt);
            
            // Cập nhật trạng thái
            rp.bot.crouch = rp.isCrouching ? 1 : 0;
            rp.bot.alive = rp.isAlive;
            rp.model.root.visible = rp.isAlive; // Ẩn nếu chết

            // Cập nhật Animation
            rp.model.update(dt, rp.bot);
        }

        // --- 2. GỬI VỊ TRÍ CỦA BẢN THÂN LÊN SERVER ---
        const now = performance.now();
        if (now - this.lastTick > this.tickRate) {
            this.lastTick = now;
            const localP = this.game.player;
            if (localP) {
                this.socket.emit('playerMovement', {
                    x: localP.position.x,
                    y: localP.position.y,
                    z: localP.position.z,
                    yaw: localP.yaw,
                    pitch: localP.pitch,
                    crouch: localP.crouching,
                    sprint: localP.sprinting,
                    alive: localP.alive
                });
            }
        }
    }

    emitShot() {
        if (this.socket && this.game.player.alive) {
            const p = this.game.player;
            this.socket.emit('playerShot', { 
                x: p.position.x, 
                y: p.position.y, 
                z: p.position.z, 
                yaw: p.yaw 
            });
        }
    }
}