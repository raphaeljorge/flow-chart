import './style.css';
import { NodeEditor } from './editor/NodeEditor'; 
import '@phosphor-icons/web/regular';

const app = document.querySelector<HTMLDivElement>('#app')!;

const editor = new NodeEditor(app, {
  showPalette: true,
  showToolbar: true,
  defaultScale: 1,
  gridSize: 20,
  showGrid: true,
  snapToGrid: false
});

// Adicionar a lógica para os botões de Salvar/Carregar
const saveGraphBtn = document.getElementById('saveGraphBtn');
const loadGraphBtn = document.getElementById('loadGraphBtn');
const clearGraphBtn = document.getElementById('clearGraphBtn');

let currentGraphData: any = null; // Para armazenar o gráfico salvo em memória ou localStorage

if (saveGraphBtn) {
  saveGraphBtn.addEventListener('click', () => {
    const graphData = editor.saveGraph();
    console.log('Graph Saved:', graphData);
    // Para persistência real, você pode usar localStorage ou enviar para um servidor
    localStorage.setItem('flowchart_saved_data', JSON.stringify(graphData));
    currentGraphData = graphData; // Armazena em memória para teste rápido
    alert('Graph saved to console and localStorage!');
  });
}

if (loadGraphBtn) {
  loadGraphBtn.addEventListener('click', () => {
    // Tenta carregar do localStorage primeiro, senão usa o que está em memória
    const savedData = localStorage.getItem('flowchart_saved_data');
    if (savedData) {
      currentGraphData = JSON.parse(savedData);
    }

    if (currentGraphData) {
      editor.loadGraph(currentGraphData);
      console.log('Graph Loaded:', currentGraphData);
      alert('Graph loaded!');
    } else {
      alert('No saved graph data found!');
    }
  });
}

if (clearGraphBtn) {
    clearGraphBtn.addEventListener('click', () => {
        // Carga de um grafo vazio para limpar
        editor.loadGraph({
            nodes: [],
            stickyNotes: [],
            connections: [],
            viewState: {
                scale: 1,
                offset: { x: 0, y: 0 },
                showGrid: true,
                snapToGrid: false,
                gridSize: 20
            }
        });
        currentGraphData = null; // Limpa os dados em memória
        localStorage.removeItem('flowchart_saved_data'); // Limpa do localStorage
        alert('Graph cleared!');
    });
}

// Opcional: Carregar o último grafo salvo automaticamente ao iniciar
document.addEventListener('DOMContentLoaded', () => {
    const savedData = localStorage.getItem('flowchart_saved_data');
    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);
            editor.loadGraph(parsedData);
            currentGraphData = parsedData;
            console.log('Automatically loaded saved graph.');
        } catch (e) {
            console.error('Failed to parse saved graph data from localStorage:', e);
            localStorage.removeItem('flowchart_saved_data'); // Limpa dados corrompidos
        }
    }
});