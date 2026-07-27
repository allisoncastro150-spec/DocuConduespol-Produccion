const pool = require("../config/database");

async function getAll() {
  const result = await pool.query(`
    SELECT
      d.id,
      d.code,
      d.original_name AS "originalName",
      d.stored_name AS "storedName",
      d.storage_path AS "storagePath",
      d.mime_type AS "mimeType",
      d.file_size AS "fileSize",
      d.uploaded_at AS "uploadedAt",
      dep.name AS department,
      u.username AS "uploadedBy"
    FROM documents d
    INNER JOIN departments dep
      ON dep.id = d.department_id
    INNER JOIN users u
      ON u.id = d.uploaded_by
    ORDER BY d.uploaded_at DESC;
  `);

  return result.rows;
}

async function search(filters) {
  const result = await pool.query(`
    SELECT
      d.id,
      d.code,
      d.original_name AS "originalName",
      d.stored_name AS "storedName",
      d.storage_path AS "storagePath",
      d.mime_type AS "mimeType",
      d.file_size AS "fileSize",
      d.uploaded_at AS "uploadedAt",
      dep.name AS department,
      u.username AS "uploadedBy"
    FROM documents d
    INNER JOIN departments dep
      ON dep.id = d.department_id
    INNER JOIN users u
      ON u.id = d.uploaded_by
    ORDER BY d.uploaded_at DESC;
  `);

  let docs = result.rows;

  if (filters.user.role !== "admin") {
    docs = docs.filter(doc => doc.department === filters.user.department);
  }

  if (filters.code) {
    docs = docs.filter(doc =>
      doc.code.toLowerCase().includes(filters.code.toLowerCase())
    );
  }

  if (filters.q) {
    docs = docs.filter(doc =>
      doc.originalName.toLowerCase().includes(filters.q.toLowerCase())
    );
  }

  if (filters.department) {
    docs = docs.filter(doc =>
      doc.department === filters.department
    );
  }

  if (filters.from) {
    docs = docs.filter(doc =>
      doc.uploadedAt.slice(0, 10) >= filters.from
    );
  }

  if (filters.to) {
    docs = docs.filter(doc =>
      doc.uploadedAt.slice(0, 10) <= filters.to
    );
  }

  return docs;
}


async function create(document) {

  const result = await pool.query(
    `
    INSERT INTO documents (
      code,
      original_name,
      stored_name,
      file_hash,
      mime_type,
      file_size,
      storage_path,
      department_id,
      uploaded_by
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9
    )
    RETURNING
      id,
      code,
      original_name AS "originalName",
      stored_name AS "storedName",
      storage_path AS "storagePath",
      mime_type AS "mimeType",
      file_size AS "fileSize",
      uploaded_at AS "uploadedAt";
    `,
    [
      document.code,
      document.originalName,
      document.storedName,
      document.fileHash,
      document.mimeType,
      document.fileSize,
      document.storagePath,
      document.departmentId,
      document.uploadedBy
    ]
  );

  return result.rows[0];

}

async function findById(id) {

  const result = await pool.query(
    `
    SELECT
      d.id,
      d.code,
      d.original_name AS "originalName",
      d.stored_name AS "storedName",
      d.storage_path AS "storagePath",
      d.mime_type AS "mimeType",
      d.file_size AS "fileSize",
      d.uploaded_at AS "uploadedAt",
      dep.name AS department,
      u.username AS "uploadedBy"
    FROM documents d
    INNER JOIN departments dep
      ON dep.id = d.department_id
    INNER JOIN users u
      ON u.id = d.uploaded_by
    WHERE d.id = $1
    `,
    [id]
  );

  return result.rows[0];
}

async function getStats() {

  const totalDocuments = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM documents;
  `);

  const uploadedToday = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM documents
    WHERE DATE(uploaded_at) = CURRENT_DATE;
  `);

  const recent = await pool.query(`
    SELECT
      d.id,
      d.code,
      d.original_name AS "originalName",
      d.stored_name AS "storedName",
      d.storage_path AS "storagePath",
      d.mime_type AS "mimeType",
      d.file_size AS "fileSize",
      dep.name AS department,
      d.uploaded_at AS "uploadedAt",
      u.username AS "uploadedBy"
    FROM documents d
    INNER JOIN departments dep
      ON dep.id = d.department_id
    INNER JOIN users u
      ON u.id = d.uploaded_by
    ORDER BY d.uploaded_at DESC
    LIMIT 8;
`);

  return {
    documents: totalDocuments.rows[0].total,
    uploadedToday: uploadedToday.rows[0].total,
    recent: recent.rows,
  };
}
async function findByHash(fileHash) {
  console.log("========== BUSCANDO HASH ==========");
  console.log(fileHash);

  const result = await pool.query(
    `
    SELECT
      d.id,
      d.code,
      d.original_name AS "originalName",
      d.stored_name AS "storedName",
      d.storage_path AS "storagePath",
      d.mime_type AS "mimeType",
      d.file_size AS "fileSize",
      d.file_hash AS "fileHash",
      d.uploaded_at AS "uploadedAt",
      dep.name AS department,
      u.username AS "uploadedBy"
    FROM documents d
    INNER JOIN departments dep
      ON dep.id = d.department_id
    INNER JOIN users u
      ON u.id = d.uploaded_by
    WHERE d.file_hash = $1
    LIMIT 1;
    `,
    [fileHash]
  );
  console.log("RESULTADO:");
  console.log(result.rows);
  console.log("==============================");

  return result.rows[0] || null;
}

async function getNextCode(departmentCode) {

  const year = new Date().getFullYear();

  const result = await pool.query(
    `
    SELECT code
    FROM documents
    WHERE code LIKE $1
    ORDER BY code DESC
    LIMIT 1
    `,
    [`${departmentCode}-${year}-%`]
  );

  if (result.rows.length === 0) {
    return `${departmentCode}-${year}-000001`;
  }

  const lastCode = result.rows[0].code;

  const lastNumber = Number(lastCode.split("-")[2]);

  const next = String(lastNumber + 1).padStart(6, "0");

  return `${departmentCode}-${year}-${next}`;
}

async function generateCode(departmentId) {

  const departmentResult = await pool.query(
    `
    SELECT code
    FROM departments
    WHERE id = $1
    `,
    [departmentId]
  );

  if (departmentResult.rows.length === 0) {
    throw new Error("Departamento no encontrado.");
  }

  const departmentCode = departmentResult.rows[0].code;

  const year = new Date().getFullYear();

  const prefix = `${departmentCode}-${year}`;

  const last = await pool.query(
    `
    SELECT code
    FROM documents
    WHERE code LIKE $1
    ORDER BY code DESC
    LIMIT 1
    `,
    [`${prefix}%`]
  );

  let next = 1;

  if (last.rows.length > 0) {

    const lastCode = last.rows[0].code;

    const number = parseInt(lastCode.split("-")[2], 10);

    next = number + 1;

  }

  return `${prefix}-${String(next).padStart(6,"0")}`;

}

module.exports = {
  getAll,
  search,
  create,
  findById,
  findByHash,
  getStats,
  generateCode,
};