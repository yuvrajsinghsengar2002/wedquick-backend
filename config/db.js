const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone: '+05:30',
});

pool.getConnection()
  .then(conn => { console.log('✅  MySQL connected'); conn.release(); })
  .catch(err => { console.error('❌  MySQL connection failed:', err.message); process.exit(1); });

module.exports = pool;
