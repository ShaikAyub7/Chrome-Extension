console.log("hello");
const form = document.querySelector("form");

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  await fetch("https://app.asana.com/api/1.0/tasks", {
    method: "POST",
    headers: {
      Authorization:
        "Bearer 2/1209310172189048/1209310310265278:2182f41147a6d24e1c5a95f1b1122d9a",
      "Content-Type": "application/json",
    },

    body: JSON.stringify({ name: "New Task", workspace: "YOUR_WORKSPACE_ID" }),
  });
  console.log(name);
});
