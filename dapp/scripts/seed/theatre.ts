import { loadJson, toCode32, toCode16, sudoSend } from './shared';
import type { ChainClient } from './shared';

export async function seedTheatre(client: ChainClient, alice: any) {
  console.log('🎭 Seeding theatre...');
  const theatreData = loadJson('theatre_cordoba.json');
  const theatreCode = toCode32('theatre_cordoba');

  await sudoSend(client, alice, { pallet: 'Theatre', palletCall: { name: 'RegisterTheatre', params: {
    code: theatreCode,
    name: theatreData.name.slice(0, 128),
    description: theatreData.description.slice(0, 512),
    lore: (theatreData.lore || '').slice(0, 512),
  }}});

  const controlMap: Record<string, string> = {
    faithful: 'Faithful', heretic: 'Heretic', contested: 'Contested', neutral: 'Neutral',
  };
  const t0 = Date.now();
  let ok = 0;
  for (const tile of theatreData.tiles) {
    const success = await sudoSend(client, alice, { pallet: 'Theatre', palletCall: { name: 'AddNode', params: {
      theatre: theatreCode,
      coord: [tile.q, tile.r],
      terrain: toCode16(tile.terrain),
      name: tile.node.name.slice(0, 128),
      nodeType: (tile.node.type || 'terrain').slice(0, 32),
      control: controlMap[tile.node.control] || 'Neutral',
      desc: (tile.node.desc || '').slice(0, 512),
      supplySource: tile.logistics?.supply_source || false,
      demand: tile.logistics?.demand || 2,
      buildings: (tile.buildings || []).slice(0, 8).map((b: string) => toCode32(b)),
    }}});
    if (success) ok++;
  }
  console.log(`  [Theatre Nodes] ${ok}/${theatreData.tiles.length} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  const edgesVec = theatreData.edges.map((e: [number, number], i: number) => ({
    from: e[0], to: e[1], capacity: theatreData.edge_capacity[i] ?? 3,
  }));
  await sudoSend(client, alice, { pallet: 'Theatre', palletCall: { name: 'SetEdges', params: {
    theatre: theatreCode, edges: edgesVec,
  }}});
  console.log(`  [Theatre Edges] ${edgesVec.length} edges`);

  if (theatreData.context_tiles?.length) {
    const ctxTiles = theatreData.context_tiles.map((ct: any) => ({
      coord: [ct.q, ct.r], terrain: toCode16(ct.terrain),
    }));
    await sudoSend(client, alice, { pallet: 'Theatre', palletCall: { name: 'SetContextTiles', params: {
      theatre: theatreCode, tiles: ctxTiles,
    }}});
    console.log(`  [Theatre Context] ${ctxTiles.length} tiles`);
  }
}
