const repository = require("./repositories/userRepository");

async function main() {
  try {
    const users = await repository.getAll();
    console.table(users);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

main();