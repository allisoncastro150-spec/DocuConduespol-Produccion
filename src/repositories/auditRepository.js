const pool = require("../config/database");

async function create(log) {

    await pool.query(
        `
        INSERT INTO audit_logs
        (
            username,
            action,
            document_id,
            details
        )
        VALUES
        (
            $1,
            $2,
            $3,
            $4
        )
        `,
        [
            log.username,
            log.action,
            log.documentId,
            JSON.stringify(log.details || {})
        ]
    );

}

async function getAll() {

    const result = await pool.query(
        `
        SELECT
            id,
            username,
            action,
            document_id,
            details,
            created_at
        FROM audit_logs
        ORDER BY created_at DESC
        `
    );

    return result.rows;

}

async function getRecent(limit = 100) {

    const result = await pool.query(
        `
        SELECT
            username,
            action,
            document_id,
            details,
            created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [limit]
    );

    return result.rows;

}

module.exports = {
    create,
    getAll,
    getRecent
};