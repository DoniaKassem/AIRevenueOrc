export interface Entity {
  id: string;
  name: string;
  type: 'person' | 'company' | 'product' | 'feature' | 'concept' | 'location';
  aliases: string[];
  metadata: {
    description?: string;
    category?: string;
    importance?: number;
  };
}

export interface Relationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  strength: number;
  metadata: any;
}

export interface KnowledgeGraph {
  entities: Map<string, Entity>;
  relationships: Relationship[];
  entityIndex: Map<string, string[]>;
}

export function extractEntities(text: string): Entity[] {
  const entities: Entity[] = [];

  const companyPattern = /\b([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? (?:Inc|LLC|Corp|Ltd|Co))\.?)\b/g;
  const companyMatches = text.matchAll(companyPattern);
  for (const match of companyMatches) {
    entities.push({
      id: generateEntityId(match[1], 'company'),
      name: match[1],
      type: 'company',
      aliases: [],
      metadata: { importance: 0.9 },
    });
  }

  const productPattern = /(?:our|the|a)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:product|platform|solution|service|tool)/gi;
  const productMatches = text.matchAll(productPattern);
  for (const match of productMatches) {
    const productName = match[1].trim();
    if (productName.split(' ').length <= 3) {
      entities.push({
        id: generateEntityId(productName, 'product'),
        name: productName,
        type: 'product',
        aliases: [],
        metadata: { importance: 0.8 },
      });
    }
  }

  const personPattern = /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g;
  const personMatches = text.matchAll(personPattern);
  for (const match of personMatches) {
    const name = match[1];
    if (!entities.some(e => e.name === name)) {
      entities.push({
        id: generateEntityId(name, 'person'),
        name: name,
        type: 'person',
        aliases: [],
        metadata: { importance: 0.6 },
      });
    }
  }

  const conceptKeywords = [
    'automation', 'integration', 'analytics', 'reporting', 'security',
    'scalability', 'performance', 'efficiency', 'productivity', 'collaboration',
    'customization', 'optimization', 'innovation', 'transformation',
  ];

  conceptKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    if (regex.test(text)) {
      entities.push({
        id: generateEntityId(keyword, 'concept'),
        name: keyword,
        type: 'concept',
        aliases: [],
        metadata: { importance: 0.5 },
      });
    }
  });

  return deduplicateEntities(entities);
}

function generateEntityId(name: string, type: string): string {
  return `${type}:${name.toLowerCase().replace(/\s+/g, '-')}`;
}

function deduplicateEntities(entities: Entity[]): Entity[] {
  const uniqueMap = new Map<string, Entity>();

  entities.forEach(entity => {
    const existing = uniqueMap.get(entity.id);
    if (!existing || entity.metadata.importance! > existing.metadata.importance!) {
      uniqueMap.set(entity.id, entity);
    }
  });

  return Array.from(uniqueMap.values());
}

export function extractRelationships(
  text: string,
  entities: Entity[]
): Relationship[] {
  const relationships: Relationship[] = [];
  const entityNames = entities.map(e => e.name);

  const usesPattern = new RegExp(
    `(${entityNames.join('|')})\\s+(?:uses|leverages|integrates with|works with)\\s+(${entityNames.join('|')})`,
    'gi'
  );
  const usesMatches = text.matchAll(usesPattern);
  for (const match of usesMatches) {
    const source = entities.find(e => e.name.toLowerCase() === match[1].toLowerCase());
    const target = entities.find(e => e.name.toLowerCase() === match[2].toLowerCase());

    if (source && target) {
      relationships.push({
        id: `${source.id}-uses-${target.id}`,
        source_entity_id: source.id,
        target_entity_id: target.id,
        relationship_type: 'uses',
        strength: 0.8,
        metadata: {},
      });
    }
  }

  const providesPattern = new RegExp(
    `(${entityNames.join('|')})\\s+(?:provides|offers|delivers|includes)\\s+(${entityNames.join('|')})`,
    'gi'
  );
  const providesMatches = text.matchAll(providesPattern);
  for (const match of providesMatches) {
    const source = entities.find(e => e.name.toLowerCase() === match[1].toLowerCase());
    const target = entities.find(e => e.name.toLowerCase() === match[2].toLowerCase());

    if (source && target) {
      relationships.push({
        id: `${source.id}-provides-${target.id}`,
        source_entity_id: source.id,
        target_entity_id: target.id,
        relationship_type: 'provides',
        strength: 0.9,
        metadata: {},
      });
    }
  }

  const competesPattern = new RegExp(
    `(${entityNames.join('|')})\\s+(?:competes with|versus|vs\\.?)\\s+(${entityNames.join('|')})`,
    'gi'
  );
  const competesMatches = text.matchAll(competesPattern);
  for (const match of competesMatches) {
    const source = entities.find(e => e.name.toLowerCase() === match[1].toLowerCase());
    const target = entities.find(e => e.name.toLowerCase() === match[2].toLowerCase());

    if (source && target) {
      relationships.push({
        id: `${source.id}-competes-${target.id}`,
        source_entity_id: source.id,
        target_entity_id: target.id,
        relationship_type: 'competes_with',
        strength: 0.7,
        metadata: {},
      });
    }
  }

  return relationships;
}

export function buildKnowledgeGraph(chunks: Array<{ text: string }>): KnowledgeGraph {
  const allEntities: Entity[] = [];
  const allRelationships: Relationship[] = [];

  chunks.forEach(chunk => {
    const entities = extractEntities(chunk.text);
    const relationships = extractRelationships(chunk.text, entities);

    allEntities.push(...entities);
    allRelationships.push(...relationships);
  });

  const entityMap = new Map<string, Entity>();
  allEntities.forEach(entity => {
    const existing = entityMap.get(entity.id);
    if (!existing) {
      entityMap.set(entity.id, entity);
    } else {
      existing.metadata.importance = Math.max(
        existing.metadata.importance || 0,
        entity.metadata.importance || 0
      );
    }
  });

  const entityIndex = new Map<string, string[]>();
  entityMap.forEach((entity, id) => {
    const tokens = entity.name.toLowerCase().split(/\s+/);
    tokens.forEach(token => {
      if (!entityIndex.has(token)) {
        entityIndex.set(token, []);
      }
      entityIndex.get(token)!.push(id);
    });
  });

  return {
    entities: entityMap,
    relationships: allRelationships,
    entityIndex,
  };
}

export function findRelatedEntities(
  graph: KnowledgeGraph,
  entityId: string,
  maxDepth: number = 2
): Entity[] {
  const visited = new Set<string>([entityId]);
  const related: Entity[] = [];
  const queue: Array<{ id: string; depth: number }> = [{ id: entityId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.depth >= maxDepth) continue;

    const outgoing = graph.relationships.filter(
      r => r.source_entity_id === current.id && !visited.has(r.target_entity_id)
    );

    const incoming = graph.relationships.filter(
      r => r.target_entity_id === current.id && !visited.has(r.source_entity_id)
    );

    [...outgoing, ...incoming].forEach(rel => {
      const nextId =
        rel.source_entity_id === current.id ? rel.target_entity_id : rel.source_entity_id;

      if (!visited.has(nextId)) {
        visited.add(nextId);
        const entity = graph.entities.get(nextId);
        if (entity) {
          related.push(entity);
          queue.push({ id: nextId, depth: current.depth + 1 });
        }
      }
    });
  }

  return related.sort(
    (a, b) => (b.metadata.importance || 0) - (a.metadata.importance || 0)
  );
}

export function expandQueryWithGraph(
  query: string,
  graph: KnowledgeGraph
): {
  original_query: string;
  mentioned_entities: Entity[];
  related_entities: Entity[];
  expanded_terms: string[];
} {
  const mentionedEntities: Entity[] = [];
  const queryLower = query.toLowerCase();

  graph.entities.forEach(entity => {
    if (queryLower.includes(entity.name.toLowerCase())) {
      mentionedEntities.push(entity);
    }
  });

  const relatedEntities: Entity[] = [];
  mentionedEntities.forEach(entity => {
    const related = findRelatedEntities(graph, entity.id, 1);
    relatedEntities.push(...related);
  });

  const uniqueRelated = Array.from(
    new Map(relatedEntities.map(e => [e.id, e])).values()
  );

  const expandedTerms = [
    ...mentionedEntities.map(e => e.name),
    ...uniqueRelated.slice(0, 5).map(e => e.name),
  ];

  return {
    original_query: query,
    mentioned_entities: mentionedEntities,
    related_entities: uniqueRelated.slice(0, 10),
    expanded_terms: [...new Set(expandedTerms)],
  };
}

export function getEntityContext(
  graph: KnowledgeGraph,
  entityId: string
): {
  entity: Entity;
  relationships: {
    outgoing: Array<{ relationship: Relationship; target: Entity }>;
    incoming: Array<{ relationship: Relationship; source: Entity }>;
  };
  related_concepts: Entity[];
} {
  const entity = graph.entities.get(entityId);
  if (!entity) {
    throw new Error(`Entity ${entityId} not found`);
  }

  const outgoing = graph.relationships
    .filter(r => r.source_entity_id === entityId)
    .map(rel => ({
      relationship: rel,
      target: graph.entities.get(rel.target_entity_id)!,
    }))
    .filter(item => item.target);

  const incoming = graph.relationships
    .filter(r => r.target_entity_id === entityId)
    .map(rel => ({
      relationship: rel,
      source: graph.entities.get(rel.source_entity_id)!,
    }))
    .filter(item => item.source);

  const relatedConcepts = findRelatedEntities(graph, entityId, 2)
    .filter(e => e.type === 'concept')
    .slice(0, 5);

  return {
    entity,
    relationships: { outgoing, incoming },
    related_concepts: relatedConcepts,
  };
}

export function visualizeGraph(graph: KnowledgeGraph): {
  nodes: Array<{ id: string; label: string; type: string; size: number }>;
  edges: Array<{ source: string; target: string; label: string; weight: number }>;
} {
  const nodes = Array.from(graph.entities.values()).map(entity => ({
    id: entity.id,
    label: entity.name,
    type: entity.type,
    size: (entity.metadata.importance || 0.5) * 10,
  }));

  const edges = graph.relationships.map(rel => ({
    source: rel.source_entity_id,
    target: rel.target_entity_id,
    label: rel.relationship_type.replace(/_/g, ' '),
    weight: rel.strength,
  }));

  return { nodes, edges };
}

export function calculateEntityImportance(
  graph: KnowledgeGraph,
  entityId: string
): number {
  const entity = graph.entities.get(entityId);
  if (!entity) return 0;

  const degree =
    graph.relationships.filter(
      r => r.source_entity_id === entityId || r.target_entity_id === entityId
    ).length;

  const avgRelationshipStrength =
    graph.relationships
      .filter(r => r.source_entity_id === entityId || r.target_entity_id === entityId)
      .reduce((sum, r) => sum + r.strength, 0) / Math.max(degree, 1);

  const baseImportance = entity.metadata.importance || 0.5;

  const importance = baseImportance * 0.4 + (degree / 10) * 0.3 + avgRelationshipStrength * 0.3;

  return Math.min(importance, 1.0);
}
