const regua = document.getElementById("regua");
const totalCompassos = 200;
const batidasPorCompasso = 4;

// Use um DocumentFragment para melhorar o desempenho
const fragment = document.createDocumentFragment();

for (let i = 1; i <= totalCompassos; i++) {
    // Cria o elemento para o compasso
    const divCompasso = document.createElement("div");
    divCompasso.className = "compasso";

    for (let j = 1; j <= batidasPorCompasso; j++) {
        // Cria o elemento para a batida
        const divBatida = document.createElement("div");
        divBatida.className = "batida";
        divBatida.setAttribute("data-numero", `${i}.${j}`);
        
        // Adiciona a batida ao compasso
        divCompasso.appendChild(divBatida);
    }

    // Adiciona o compasso completo ao fragmento
    fragment.appendChild(divCompasso);
}

// Adiciona todos os compassos ao DOM de uma só vez
regua.appendChild(fragment);