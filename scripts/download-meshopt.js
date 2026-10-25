import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.join(__dirname, '../node_modules/three/examples/jsm/libs');
const filePath = path.join(dir, 'meshopt_simplifier.module.js');

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

if (!fs.existsSync(filePath)) {
    console.log('⏳ Đang tải file meshopt_simplifier.module.js từ nguồn meshoptimizer...');
    try {
        // Sử dụng file từ thư viện meshoptimizer gốc trên jsdelivr (ổn định 100%)
        const response = await fetch('https://cdn.jsdelivr.net/npm/meshoptimizer@0.20.0/meshopt_simplifier.module.js');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
        console.log('✅ Tải file thành công!');
    } catch (e) {
        console.error('❌ Lỗi khi tải file:', e.message);
    }
} else {
    console.log('✅ File meshopt_simplifier.module.js đã tồn tại.');
}