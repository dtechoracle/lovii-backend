"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const connect_1 = __importDefault(require("./routes/connect"));
const notes_1 = __importDefault(require("./routes/notes"));
const profile_1 = __importDefault(require("./routes/profile"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const widget_1 = __importDefault(require("./routes/widget"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.get('/', (req, res) => {
    res.json({ message: 'Lovii Backend is running!' });
});
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Backend is connected! 🚀',
        timestamp: new Date().toISOString()
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/connect', connect_1.default);
app.use('/api/notes', notes_1.default);
app.use('/api/profile', profile_1.default);
app.use('/api/tasks', tasks_1.default);
app.use('/api/widget', widget_1.default);
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
