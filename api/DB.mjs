import mysql from 'mysql2/promise';

export class DB {
    constructor(host, user = null, password = null, database = "nodeeditor", port = null) {
        this.host = host;
        this.port = port || 3306;
        this.user = user || process.env.MYSQL_USER;
        this.password = password || process.env.MYSQL_PASSWORD;
        this.database = database;
    }

    async connect() {
        this.connection = await mysql.createConnection({
            host: this.host,
            port: this.port,
            user: this.user,
            password: this.password,
            database: this.database
        });
    }

    async close() {
        await this.connection.end();
    }

    async query(sql, params) {
        try {
            const [rows] = await this.connection.execute(sql, params);
            return rows;
        } catch (e) {
            if (e.toString().includes("connection is in closed state")) {
                console.log("Reconnecting to database...");
                await this.connect();
                const [rows] = await this.connection.execute(sql, params);
                return rows;
            } else {
                throw e;
            }
        }
    }

    async getUserByUsername(username) {
        const rows = await this.query("SELECT * FROM accounts.users WHERE username = ?", [username]);
        return rows ? rows[0] : null;
    }

    async getUserById(id) {
        const rows = await this.query("SELECT * FROM accounts.users WHERE id = ?", [id]);
        return rows ? rows[0] : null;
    }

    async insertUser(username, hashedPassword, ip) {
        await this.query("INSERT INTO accounts.users (username, password_hash, ip) VALUES (?, ?, ?)", [username, hashedPassword, ip]);
    }

    async getAvailableSubscriptionByProductId(id) {
        return await this.query("SELECT * FROM finance.available_subscriptions WHERE product_id = ?", [id]);
    }

    async getUserSubscriptions(id, subscriptionIds) {
        return await this.query("SELECT * FROM finance.subscriptions WHERE user_id = ? AND subscription_id IN (?)", [id, subscriptionIds.join(",")]);
    }

    async saveAvatar(userId, avatar) {
        await this.query("INSERT INTO nodeeditor.avatars (user_id, avatar_data) VALUES (?, ?) ON DUPLICATE KEY UPDATE avatar_data = ?", [userId, avatar, avatar]);
    }

    async getAvatar(userId) {
        const rows = await this.query("SELECT avatar_data FROM nodeeditor.avatars WHERE user_id = ?", [userId]);
        const firstRow = rows[0];
        return firstRow ? firstRow.avatar_data : null;
    }

    async saveGraph(userId, graph) {
        await this.query("INSERT INTO nodeeditor.graphs (user_id, graph_json) VALUES (?, ?)", [userId, graph]);
    }

    async getUserGraphs(userId) {
        return await this.query("SELECT * FROM nodeeditor.graphs WHERE user_id = ?", [userId]);
    }

    async getGraph(graphId) {
        const rows = await this.query("SELECT * FROM nodeeditor.graphs WHERE graph_id = ?", [graphId]);
        return rows ? rows[0] : null;
    }

    async deleteGraph(userId, graphId) {
        await this.query("DELETE FROM nodeeditor.graphs WHERE user_id = ? AND graph_id = ?", [userId, graphId]);
    }
}