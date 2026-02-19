import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import connectRoutes from './routes/connect';
import notesRoutes from './routes/notes';
import profileRoutes from './routes/profile';
import tasksRoutes from './routes/tasks';
import widgetRoutes from './routes/widget';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

app.use('/api/auth', authRoutes);
app.use('/api/connect', connectRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/widget', widgetRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
