import { io } from "socket.io-client";
import * as THREE from 'three';

export class Network {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.remotePlayers = {};
        this.tickRate = 50; 
        this.lastTick = 0;
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        const serverUrl = `http://${host}:3000`;
        
        console.log(`[DEADLOCK] Đang kết nối tới Server: ${serverUrl}`);
        this.socket = io(serverUrl);

        this.socket.on('connect', () => {
            console.log('✅ Đã kết nối Server Multiplayer, ID:', this.socket.id);
        });

        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                if (id !== this.socket.id) this.addRemotePlayer(players[id]);
            });
        });

        this.socket.on('newPlayer', (playerInfo) => {
            this.addRemotePlayer(playerInfo);
        });

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
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
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
        const model = this.game.charTemplate.instance(info.team || 0);
        model.root.position.set(info.x, info.y, info.z);
        this.game.renderer.scene.add(model.root);

        const playerName = `PLAYER_${info.id.substring(0, 4)}`;
        const nameTag = this.createNameTag(playerName, false);
        model.root.add(nameTag);

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

        if (this.game.charTemplate) {
            model.attachWeapon(fakeBot);
        }

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

        for (const id in this.remotePlayers) {
            const rp = this.remotePlayers[id];
            
            rp.bot.position.lerp(rp.targetPos, 15 * dt);
            rp.bot.yaw = THREE.MathUtils.lerp(rp.bot.yaw, rp.targetYaw, 15 * dt);
            rp.bot.pitch = THREE.MathUtils.lerp(rp.bot.pitch, rp.targetPitch, 15 * dt);
            rp.bot.crouch = rp.isCrouching ? 1 : 0;
            rp.bot.alive = rp.isAlive;

            rp.model.update(dt, rp.bot);
        }

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
                x: p.position.x, y: p.position.y, z: p.position.z,
                yaw: p.yaw
            });
        }
    }
}