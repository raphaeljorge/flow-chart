// src/editor/services/AutoLayoutService.ts
import * as dagre from 'dagre';
import { Node, Connection, Point } from '../core/types';

export class AutoLayoutService {
  /**
   * Calcula as novas posições para os nós usando o algoritmo de Dagre.
   * @param nodes - A lista de nós do editor.
   * @param connections - A lista de conexões do editor.
   * @returns Um Map onde a chave é o ID do nó e o valor é a nova posição {x, y}.
   */
  public layoutGraph(nodes: Node[], connections: Connection[]): Map<string, Point> {
    // 1. Inicializa o grafo do Dagre
    const g = new dagre.graphlib.Graph();

    // 2. Configura o grafo
    // 'TB' = Top to Bottom (de cima para baixo). Você pode usar 'LR' para Left to Right (esquerda para direita).
    g.setGraph({
      rankdir: 'TB',
      ranksep: 70, // Distância vertical entre as camadas
      nodesep: 50, // Distância horizontal entre os nós na mesma camada
    });

    // Define um rótulo padrão para as arestas (necessário pelo Dagre)
    g.setDefaultEdgeLabel(() => ({}));

    // 3. Adiciona os nós ao grafo do Dagre com suas dimensões
    nodes.forEach(node => {
      g.setNode(node.id, { width: node.width, height: node.height });
    });

    // 4. Adiciona as conexões (arestas) ao grafo do Dagre
    connections.forEach(connection => {
      // Garante que a conexão seja entre nós que ainda existem
      if (g.hasNode(connection.sourceNodeId) && g.hasNode(connection.targetNodeId)) {
        g.setEdge(connection.sourceNodeId, connection.targetNodeId);
      }
    });

    // 5. Executa o algoritmo de layout
    dagre.layout(g);

    // 6. Extrai as novas posições calculadas
    const newPositions = new Map<string, Point>();
    g.nodes().forEach(nodeId => {
      const node = g.node(nodeId);
      if (node) {
        // Dagre calcula a posição do centro do nó, então ajustamos para o canto superior esquerdo
        newPositions.set(nodeId, {
          x: node.x - node.width / 2,
          y: node.y - node.height / 2,
        });
      }
    });

    return newPositions;
  }
}