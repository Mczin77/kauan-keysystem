async function login() {
  const user = document.getElementById("user").value;
  const pass = document.getElementById("pass").value;
  const msg = document.getElementById("msg");

  msg.innerText = "Verificando...";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ user, pass })
    });

    const data = await res.json();

    if (data.ok) {
      localStorage.setItem("token", data.token);
      msg.innerText = "Login bem sucedido! Redirecionando...";
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
    } else {
      msg.innerText = "Usuário ou senha incorretos.";
    }

  } catch (e) {
    msg.innerText = "Erro ao conectar ao servidor.";
  }
}
