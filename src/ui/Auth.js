// src/ui/Auth.js
export class Auth {
    constructor(onLoginSuccess) {
        this.onLoginSuccess = onLoginSuccess;
        this.el = document.createElement('div');
        this.el.id = 'auth-screen';
        this.el.style.cssText = `
            position: fixed; inset: 0; z-index: 1000; background: #050a10;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background-image: radial-gradient(circle at 50% 50%, #0a1a2a 0%, #000 100%);
            font-family: 'Rajdhani', sans-serif; color: #fff;
        `;
        this.render();
        document.body.appendChild(this.el);
    }

    render() {
        this.el.innerHTML = `
            <div style="font-size: 50px; font-weight: 900; letter-spacing: 8px; margin-bottom: 30px; background: linear-gradient(180deg, #fff, #00ffcc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">DEADLOCK</div>
            
            <div style="background: rgba(0,15,25,0.8); border: 1px solid rgba(0,255,204,0.3); padding: 40px; border-radius: 8px; width: 400px; box-shadow: 0 0 30px rgba(0,255,204,0.1);">
                <div style="display: flex; gap: 20px; margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <div id="tab-login" style="cursor: pointer; color: #00ffcc; font-weight: bold; font-size: 18px;">ĐĂNG NHẬP</div>
                    <div id="tab-register" style="cursor: pointer; color: #666; font-weight: bold; font-size: 18px;">ĐĂNG KÝ</div>
                </div>

                <div id="form-login">
                    <input type="text" id="login-user" placeholder="Tên đăng nhập" style="width: 100%; padding: 12px; margin-bottom: 15px; background: #111; border: 1px solid #444; color: #fff; border-radius: 4px; outline: none;">
                    <input type="password" id="login-pass" placeholder="Mật khẩu" style="width: 100%; padding: 12px; margin-bottom: 20px; background: #111; border: 1px solid #444; color: #fff; border-radius: 4px; outline: none;">
                    <button id="btn-login" style="width: 100%; padding: 15px; background: #00ffcc; color: #000; font-weight: bold; font-size: 18px; border: none; border-radius: 4px; cursor: pointer;">VÀO GAME</button>
                </div>

                <div id="form-register" style="display: none;">
                    <input type="text" id="reg-user" placeholder="Tên đăng nhập" style="width: 100%; padding: 12px; margin-bottom: 15px; background: #111; border: 1px solid #444; color: #fff; border-radius: 4px; outline: none;">
                    <input type="text" id="reg-name" placeholder="Tên hiển thị trong game" style="width: 100%; padding: 12px; margin-bottom: 15px; background: #111; border: 1px solid #444; color: #fff; border-radius: 4px; outline: none;">
                    <input type="password" id="reg-pass" placeholder="Mật khẩu" style="width: 100%; padding: 12px; margin-bottom: 20px; background: #111; border: 1px solid #444; color: #fff; border-radius: 4px; outline: none;">
                    <button id="btn-register" style="width: 100%; padding: 15px; background: #ff4444; color: #fff; font-weight: bold; font-size: 18px; border: none; border-radius: 4px; cursor: pointer;">TẠO TÀI KHOẢN</button>
                </div>
                
                <div id="auth-error" style="color: #ff4444; margin-top: 15px; text-align: center; font-weight: bold; display: none;"></div>
            </div>
        `;

        // Xử lý chuyển tab
        const tabLogin = this.el.querySelector('#tab-login');
        const tabReg = this.el.querySelector('#tab-register');
        const formLogin = this.el.querySelector('#form-login');
        const formReg = this.el.querySelector('#form-register');

        tabLogin.onclick = () => {
            tabLogin.style.color = '#00ffcc'; tabReg.style.color = '#666';
            formLogin.style.display = 'block'; formReg.style.display = 'none';
        };
        tabReg.onclick = () => {
            tabReg.style.color = '#ff4444'; tabLogin.style.color = '#666';
            formReg.style.display = 'block'; formLogin.style.display = 'none';
        };

        // Xử lý API
        const showError = (msg) => {
            const err = this.el.querySelector('#auth-error');
            err.textContent = msg;
            err.style.display = 'block';
        };

        this.el.querySelector('#btn-login').onclick = async () => {
            const u = this.el.querySelector('#login-user').value;
            const p = this.el.querySelector('#login-pass').value;
            const res = await fetch('http://localhost:3000/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();
            if (data.success) this.loginSuccess(data);
            else showError(data.error);
        };

        this.el.querySelector('#btn-register').onclick = async () => {
            const u = this.el.querySelector('#reg-user').value;
            const n = this.el.querySelector('#reg-name').value;
            const p = this.el.querySelector('#reg-pass').value;
            if (!u || !n || !p) return showError('Vui lòng điền đủ thông tin!');
            const res = await fetch('http://localhost:3000/api/register', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, displayName: n, password: p })
            });
            const data = await res.json();
            if (data.success) this.loginSuccess(data);
            else showError(data.error);
        };
    }

    loginSuccess(data) {
        localStorage.setItem('deadlock_token', data.token);
        localStorage.setItem('deadlock_name', data.displayName);
        localStorage.setItem('deadlock_rank', data.rankPoints);
        this.el.remove();
        this.onLoginSuccess(data.displayName);
    }
}