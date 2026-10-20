import { createDatabase } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);

const db = createDatabase();
const app = createApp(db);

app.listen(port, () => {
  console.log(`Project Management System API berjalan di http://localhost:${port}`);
  console.log(`Database: ${process.env.DB_PATH ?? 'server/data/app.db'}`);
});
