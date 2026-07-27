const repository = require("./repositories/departmentRepository");

async function main() {
  try {
    const departments = await repository.getAll();

    console.log(departments);
  } catch (err) {
    console.error(err);
  }

  process.exit();
}

main();