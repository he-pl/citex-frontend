const API_URL = 'http://localhost:5000/api';
let currentLivroId = null;

document.addEventListener('DOMContentLoaded', () => {
    showSection('home');
});

// Escapa texto do usuário antes de inserir via innerHTML, evitando que
// aspas/tags quebrem o HTML ou permitam injeção de script (XSS).
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

async function apiFetch(url, options) {
    let res;
    try {
        res = await fetch(url, options);
    } catch (e) {
        alert('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
        throw e;
    }
    if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try {
            const body = await res.json();
            if (body.error) msg = body.error;
        } catch { /* corpo não era JSON */ }
        alert(msg);
        throw new Error(msg);
    }
    return res;
}

function showSection(section) {
    document.querySelectorAll('.spa-section').forEach(el => el.classList.add('d-none'));

    if (section === 'home') {
        document.getElementById('sec-home').classList.remove('d-none');
        loadHome();
    } else if (section === 'livros') {
        document.getElementById('sec-livros').classList.remove('d-none');
        loadLivros();
    } else if (section === 'detalhe') {
        document.getElementById('sec-detalhe').classList.remove('d-none');
    }
}

// --- HOME ---
async function loadHome() {
    const lastId = localStorage.getItem('last_livro_id');
    const container = document.getElementById('home-content');

    if (!lastId) {
        container.innerHTML = `
            <div class="text-center py-5">
                <h3>Bem-vindo!</h3>
                <a href="#" class="fs-5 text-decoration-none" id="home-add-link">Adicione um livro ou autor para começar</a>
            </div>`;
        document.getElementById('home-add-link').onclick = (e) => { e.preventDefault(); showSection('livros'); };
        return;
    }

    try {
        const res = await fetch(`${API_URL}/livros/${lastId}`);
        if (!res.ok) throw new Error();
        const livro = await res.json();

        container.innerHTML = `
            <h4>Último livro acessado/editado</h4>
            <div class="card mt-3">
                <div class="card-body">
                    <h5 class="card-title">${escapeHtml(livro.livro_titulo)}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">${escapeHtml(livro.livro_autor || 'Autor não informado')}</h6>
                    <button class="btn btn-primary btn-sm mt-2" id="home-open-btn">Abrir Fichamento Completo</button>
                </div>
            </div>`;
        document.getElementById('home-open-btn').onclick = () => verDetalhes(livro.livro_id);
    } catch {
        container.innerHTML = `
            <div class="text-center py-5">
                <a href="#" class="fs-5 text-decoration-none" id="home-add-link">Adicione um livro ou autor para começar</a>
            </div>`;
        document.getElementById('home-add-link').onclick = (e) => { e.preventDefault(); showSection('livros'); };
    }
}

// --- LIVROS ---
async function loadLivros() {
    let livros;
    try {
        const res = await apiFetch(`${API_URL}/livros`);
        livros = await res.json();
    } catch {
        return; // erro já exibido por apiFetch
    }

    const tbody = document.getElementById('tabela-livros');
    tbody.innerHTML = '';

    livros.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><a href="#" class="livro-link">${escapeHtml(l.livro_titulo)}</a></td>
            <td>${escapeHtml(l.livro_autor || '-')}</td>
            <td>${escapeHtml(l.livro_editora || '-')}</td>
            <td>${l.livro_anopublic || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary btn-editar">Editar</button>
                <button class="btn btn-sm btn-outline-danger btn-excluir">Excluir</button>
            </td>`;
        tr.querySelector('.livro-link').addEventListener('click', (e) => { e.preventDefault(); verDetalhes(l.livro_id); });
        tr.querySelector('.btn-editar').addEventListener('click', () => prepararEdicaoLivro(l));
        tr.querySelector('.btn-excluir').addEventListener('click', () => deletarLivro(l.livro_id));
        tbody.appendChild(tr);
    });
}

async function autoPreencherOpenLibrary() {
    const isbn = document.getElementById('ISBN').value.trim();
    if (!isbn) return alert('Insira um número de ISBN.');

    try {
        const res = await fetch(`${API_URL}/openlibrary/${isbn}`);
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return alert(body.error || 'Livro não localizado na Open Library.');
        }
        const data = await res.json();

        document.getElementById('livro_titulo').value = data.livro_titulo || '';
        document.getElementById('livro_subtitulo').value = data.livro_subtitulo || '';
        document.getElementById('livro_autor').value = data.livro_autor || '';
        document.getElementById('livro_editora').value = data.livro_editora || '';
        document.getElementById('livro_anopublic').value = data.livro_anopublic || '';
        document.getElementById('livro_localpublic').value = data.livro_localpublic || '';
    } catch (e) {
        alert('Erro ao buscar dados do ISBN.');
    }
}

async function handleSalvarLivro(e) {
    e.preventDefault();
    const id = document.getElementById('livro_id').value;
    const titulo = document.getElementById('livro_titulo').value.trim();

    if (!titulo) {
        alert('O título é obrigatório.');
        return;
    }

    const body = {
        ISBN: document.getElementById('ISBN').value,
        livro_titulo: titulo,
        livro_subtitulo: document.getElementById('livro_subtitulo').value,
        livro_autor: document.getElementById('livro_autor').value,
        livro_editora: document.getElementById('livro_editora').value,
        livro_anopublic: document.getElementById('livro_anopublic').value ? parseInt(document.getElementById('livro_anopublic').value) : null,
        livro_localpublic: document.getElementById('livro_localpublic').value,
        livro_comentario: document.getElementById('livro_comentario').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/livros/${id}` : `${API_URL}/livros`;

    try {
        await apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch {
        return; // erro já exibido
    }

    resetFormLivro();
    loadLivros();
}

function prepararEdicaoLivro(livro) {
    document.getElementById('livro_id').value = livro.livro_id;
    document.getElementById('ISBN').value = livro.ISBN || '';
    document.getElementById('livro_titulo').value = livro.livro_titulo;
    document.getElementById('livro_subtitulo').value = livro.livro_subtitulo || '';
    document.getElementById('livro_autor').value = livro.livro_autor || '';
    document.getElementById('livro_editora').value = livro.livro_editora || '';
    document.getElementById('livro_anopublic').value = livro.livro_anopublic || '';
    document.getElementById('livro_localpublic').value = livro.livro_localpublic || '';
    document.getElementById('livro_comentario').value = livro.livro_comentario || '';

    document.getElementById('form-livro-title').innerText = 'Editar Livro';
    document.getElementById('btn-cancelar-edit').classList.remove('d-none');
}

function resetFormLivro() {
    document.getElementById('form-livro').reset();
    document.getElementById('livro_id').value = '';
    document.getElementById('form-livro-title').innerText = 'Adicionar Livro';
    document.getElementById('btn-cancelar-edit').classList.add('d-none');
}

async function deletarLivro(id) {
    if (!confirm('Deseja excluir este livro e todas as suas citações?')) return;
    try {
        await apiFetch(`${API_URL}/livros/${id}`, { method: 'DELETE' });
    } catch {
        return;
    }
    if (localStorage.getItem('last_livro_id') == id) {
        localStorage.removeItem('last_livro_id');
    }
    loadLivros();
}

// --- DETALHES DO LIVRO E CITAÇÕES ---
async function verDetalhes(id) {
    currentLivroId = id;
    localStorage.setItem('last_livro_id', id);
    showSection('detalhe');

    let livro;
    try {
        const res = await apiFetch(`${API_URL}/livros/${id}`);
        livro = await res.json();
    } catch {
        return;
    }

    const card = document.getElementById('detalhe-livro-card');
    card.innerHTML = `
        <div class="card">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h3 class="card-title">${escapeHtml(livro.livro_titulo)}</h3>
                        ${livro.livro_subtitulo ? `<h5 class="text-muted">${escapeHtml(livro.livro_subtitulo)}</h5>` : ''}
                    </div>
                    <div>
                        <button class="btn btn-outline-primary btn-sm" id="btn-editar-ficha">Editar Ficha</button>
                        <button class="btn btn-outline-danger btn-sm" id="btn-excluir-ficha">Excluir</button>
                    </div>
                </div>
                <hr>
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Autor:</strong> ${escapeHtml(livro.livro_autor || 'N/A')}</p>
                        <p><strong>Editora:</strong> ${escapeHtml(livro.livro_editora || 'N/A')}</p>
                        <p><strong>ISBN:</strong> ${escapeHtml(livro.ISBN || 'N/A')}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Ano:</strong> ${livro.livro_anopublic || 'N/A'}</p>
                        <p><strong>Local:</strong> ${escapeHtml(livro.livro_localpublic || 'N/A')}</p>
                        <p><strong>Comentário:</strong> ${escapeHtml(livro.livro_comentario || 'N/A')}</p>
                    </div>
                </div>
            </div>
        </div>`;

    document.getElementById('btn-editar-ficha').onclick = () => prepararEdicaoLivroEDirigir(livro);
    document.getElementById('btn-excluir-ficha').onclick = async () => {
        await deletarLivro(livro.livro_id);
        showSection('livros');
    };

    renderCitacoes(livro.citacoes);
}

function prepararEdicaoLivroEDirigir(livro) {
    showSection('livros');
    prepararEdicaoLivro(livro);
}

// --- FUNÇÃO PARA FORMATAR NÚMEROS DE PÁGINA ---
function formatarPaginas(inicio, fim) {
    const pInicio = inicio ? String(inicio).trim() : '';
    const pFim = fim ? String(fim).trim() : '';

    if (!pInicio && !pFim) return '';

    // Se a página final não for informada ou for igual à inicial
    if (!pFim || pInicio === pFim) {
        return `(p. ${pInicio})`;
    }

    // Se forem páginas diferentes
    return `(pp. ${pInicio} - ${pFim})`;
}

function renderCitacoes(citacoes) {
    const container = document.getElementById('lista-citacoes');
    container.innerHTML = '';

    if (!citacoes || citacoes.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhuma citação cadastrada.</p>';
        return;
    }

    citacoes.forEach(c => {
        const paginas = formatarPaginas(c.pagina_inicial, c.pagina_final);

        const div = document.createElement('div');
        div.className = 'border-start border-3 border-primary ps-3 py-2 mb-3 bg-white rounded shadow-sm';
        div.innerHTML = `
            <p class="fst-italic mb-1">"${escapeHtml(c.texto_citacao)}" <strong>${escapeHtml(paginas)}</strong></p>
            ${c.comentario ? `<p class="text-muted small mb-1"><strong>Nota:</strong> ${escapeHtml(c.comentario)}</p>` : ''}
            <div class="mt-2">
                <button class="btn btn-sm btn-link p-0 me-2 btn-editar-citacao">Editar</button>
                <button class="btn btn-sm btn-link text-danger p-0 btn-excluir-citacao">Excluir</button>
            </div>`;
        div.querySelector('.btn-editar-citacao').addEventListener('click', () => prepararEdicaoCitacao(c));
        div.querySelector('.btn-excluir-citacao').addEventListener('click', () => deletarCitacao(c.citacao_id));
        container.appendChild(div);
    });
}

async function handleSalvarCitacao(e) {
    e.preventDefault();
    const id = document.getElementById('citacao_id').value;
    const pInicial = document.getElementById('pagina_inicial').value.trim();
    let pFinal = document.getElementById('pagina_final').value.trim();
    const texto = document.getElementById('texto_citacao').value.trim();

    if (!texto) {
        alert('O texto da citação é obrigatório.');
        return;
    }

    // Se preencher apenas a página inicial, preenche a final com o mesmo valor por padrão
    if (pInicial && !pFinal) {
        pFinal = pInicial;
    }

    const body = {
        livro_id: currentLivroId,
        pagina_inicial: pInicial,
        pagina_final: pFinal,
        texto_citacao: texto,
        comentario: document.getElementById('citacao_comentario').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/citacoes/${id}` : `${API_URL}/citacoes`;

    try {
        await apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch {
        return;
    }

    resetFormCitacao();
    verDetalhes(currentLivroId);
}

function prepararEdicaoCitacao(c) {
    document.getElementById('citacao_id').value = c.citacao_id;
    document.getElementById('pagina_inicial').value = c.pagina_inicial || '';
    document.getElementById('pagina_final').value = c.pagina_final || '';
    document.getElementById('texto_citacao').value = c.texto_citacao;
    document.getElementById('citacao_comentario').value = c.comentario || '';

    document.getElementById('form-citacao-title').innerText = 'Editar Citação';
    document.getElementById('btn-cancelar-citacao').classList.remove('d-none');
}

function resetFormCitacao() {
    document.getElementById('form-citacao').reset();
    document.getElementById('citacao_id').value = '';
    document.getElementById('form-citacao-title').innerText = 'Adicionar Citação';
    document.getElementById('btn-cancelar-citacao').classList.add('d-none');
}

async function deletarCitacao(id) {
    if (!confirm('Deseja excluir esta citação?')) return;
    try {
        await apiFetch(`${API_URL}/citacoes/${id}`, { method: 'DELETE' });
    } catch {
        return;
    }
    verDetalhes(currentLivroId);
}
