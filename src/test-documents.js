const repository = require("./repositories/documentRepository");

async function main() {
  try {
    const docs = await repository.getAll();

    console.table(docs);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

main();