import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { theatre, storage } from '../chain'
import type { TheatreNode, TheatreGraph } from '../chain/theatre'
import type { TerrainType, MapResource, ResourceType } from '../chain/types'
import { terrain as terrainData } from '../data'
import { Stepper } from '../components/Stepper'

const STEPS = [
  { label: 'Region' },
  { label: 'Lore' },
  { label: 'Graph' },
  { label: 'Map Image' },
  { label: 'Position' },
  { label: 'Submit' },
]

const TERRAIN_TYPES: TerrainType[] = [
  'port', 'coastal', 'fortress', 'mountain_pass', 'mountain',
  'forest', 'ruins', 'factory', 'city', 'village',
  'plains', 'bridge', 'cathedral', 'marsh',
  'mine', 'quarry', 'laboratory', 'monastery',
  'hellgate', 'crossroads', 'harbor', 'encampment',
]

const RESOURCE_TYPES: ResourceType[] = ['ducats', 'iron', 'powder', 'flesh', 'relics', 'alchemy', 'occult']

export function TheatreCreate() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  // Step 1
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')

  // Step 2
  const [description, setDescription] = useState('')
  const [lore, setLore] = useState('')

  // Step 3
  const [nodes, setNodes] = useState<TheatreNode[]>([])
  const [edges, setEdges] = useState<[number, number][]>([])
  const [newNodeName, setNewNodeName] = useState('')
  const [newNodeTerrain, setNewNodeTerrain] = useState<TerrainType>('city')
  const [edgeFrom, setEdgeFrom] = useState<number>(0)
  const [edgeTo, setEdgeTo] = useState<number>(0)

  // Step 4
  const [mapCid, setMapCid] = useState<string | null>(null)
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 5 — drag state
  const [dragging, setDragging] = useState<{ nodeId: number; startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function addNode() {
    if (!newNodeName.trim()) return
    const id = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 0
    setNodes([...nodes, {
      id,
      name: newNodeName.trim(),
      subtitle: '',
      description: '',
      terrain: newNodeTerrain,
      resources: [],
      position: { x: 50, y: 50 },
    }])
    setNewNodeName('')
  }

  function removeNode(id: number) {
    setNodes(nodes.filter(n => n.id !== id))
    setEdges(edges.filter(([a, b]) => a !== id && b !== id))
  }

  function updateNodeField(id: number, field: keyof TheatreNode, value: unknown) {
    setNodes(nodes.map(n => n.id === id ? { ...n, [field]: value } : n))
  }

  function addResource(nodeId: number, type: ResourceType) {
    setNodes(nodes.map(n => {
      if (n.id !== nodeId) return n
      const existing = n.resources.find(r => r.type === type)
      if (existing) return n
      return { ...n, resources: [...n.resources, { type, output: 1 }] }
    }))
  }

  function removeResource(nodeId: number, type: ResourceType) {
    setNodes(nodes.map(n => {
      if (n.id !== nodeId) return n
      return { ...n, resources: n.resources.filter(r => r.type !== type) }
    }))
  }

  function updateResourceOutput(nodeId: number, type: ResourceType, output: number) {
    setNodes(nodes.map(n => {
      if (n.id !== nodeId) return n
      return { ...n, resources: n.resources.map(r => r.type === type ? { ...r, output } : r) }
    }))
  }

  function addEdge() {
    if (edgeFrom === edgeTo) return
    const exists = edges.some(([a, b]) => (a === edgeFrom && b === edgeTo) || (a === edgeTo && b === edgeFrom))
    if (exists) return
    setEdges([...edges, [edgeFrom, edgeTo]])
  }

  function removeEdge(idx: number) {
    setEdges(edges.filter((_, i) => i !== idx))
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const cid = await storage.uploadToIpfs(file)
    setMapCid(cid)
    setMapPreviewUrl(URL.createObjectURL(file))
  }

  function generatePrompt(): string {
    const nodeList = nodes.map(n => `- ${n.name} (${n.terrain}): ${n.subtitle || n.description || 'strategic location'}`).join('\n')
    const edgeList = edges.map(([a, b]) => `  ${nodes.find(n => n.id === a)?.name} <-> ${nodes.find(n => n.id === b)?.name}`).join('\n')
    return `Generate a top-down illustrated campaign map in a WWI military staff map style (sepia, parchment, hand-drawn ink lines) for the following theatre of operations:

Region: ${region}
Name: ${name}
Description: ${description}

Locations (${nodes.length} nodes):
${nodeList}

Connections:
${edgeList}

Style: Aged parchment background, hand-drawn topographic lines, ink terrain icons, compass rose in corner. No text labels (we'll overlay them digitally). Aspect ratio 16:9.`
  }

  // Step 5 drag handlers
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = ((e.clientX - dragging.startX) / rect.width) * 100
    const dy = ((e.clientY - dragging.startY) / rect.height) * 100
    setNodes(prev => prev.map(n =>
      n.id === dragging.nodeId
        ? { ...n, position: { x: Math.max(2, Math.min(98, dragging.startPosX + dx)), y: Math.max(2, Math.min(98, dragging.startPosY + dy)) } }
        : n
    ))
  }, [dragging])

  function handleMouseDown(e: React.MouseEvent, node: TheatreNode) {
    e.preventDefault()
    setDragging({ nodeId: node.id, startX: e.clientX, startY: e.clientY, startPosX: node.position.x, startPosY: node.position.y })
  }

  function handleMouseUp() {
    setDragging(null)
  }

  async function handleSubmit() {
    const graph: TheatreGraph = { nodes, edges }
    await theatre.createTheatre({ name, region, description, lore, map_cid: mapCid, graph })
    navigate('/longwar/theatres')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl mb-6">Create Theatre of Operations</h1>
      <Stepper steps={STEPS} currentStep={step} />

      {/* Step 0: Region */}
      {step === 0 && (
        <div className="space-y-6">
          <Field label="Theatre Name">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. The Breach of Córdoba"
              className="input-field"
            />
          </Field>
          <Field label="Region / Geographic Area">
            <input
              type="text"
              value={region}
              onChange={e => setRegion(e.target.value)}
              placeholder="e.g. Southern Spain, The Holy Land, Northern France..."
              className="input-field"
            />
          </Field>
          <button
            onClick={() => setStep(1)}
            disabled={!name.trim() || !region.trim()}
            className="btn-primary w-full"
          >
            Next: Lore
          </button>
        </div>
      )}

      {/* Step 1: Lore */}
      {step === 1 && (
        <div className="space-y-6">
          <Field label="Description (short)">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A brief description of this theatre..."
              rows={3}
              className="input-field"
            />
          </Field>
          <Field label="Lore (narrative context)">
            <textarea
              value={lore}
              onChange={e => setLore(e.target.value)}
              placeholder="The historical and narrative context of this theatre of operations..."
              rows={6}
              className="input-field"
            />
          </Field>
          <div className="flex gap-4">
            <button onClick={() => setStep(0)} className="btn-secondary flex-1">Back</button>
            <button onClick={() => setStep(2)} disabled={!description.trim()} className="btn-primary flex-1">
              Next: Graph
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Graph */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Add node */}
          <div className="card-military p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Add Location Node</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newNodeName}
                onChange={e => setNewNodeName(e.target.value)}
                placeholder="Location name..."
                className="input-field flex-1"
              />
              <select
                value={newNodeTerrain}
                onChange={e => setNewNodeTerrain(e.target.value as TerrainType)}
                className="input-field w-40"
              >
                {TERRAIN_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
              <button onClick={addNode} className="btn-primary px-4">+ Add</button>
            </div>
          </div>

          {/* Node list */}
          {nodes.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
                Nodes ({nodes.length})
              </h3>
              <div className="space-y-2">
                {nodes.map(node => (
                  <div key={node.id} className="card-military p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold flex-1">{node.name}</span>
                      <span className="text-xs text-[var(--sepia)]">{node.terrain.replace('_', ' ')}</span>
                      <button
                        onClick={() => removeNode(node.id)}
                        className="text-[var(--accent)] text-xs font-bold cursor-pointer hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      value={node.subtitle}
                      onChange={e => updateNodeField(node.id, 'subtitle', e.target.value)}
                      placeholder="Subtitle..."
                      className="input-field w-full mb-2 text-sm"
                    />
                    <input
                      type="text"
                      value={node.description}
                      onChange={e => updateNodeField(node.id, 'description', e.target.value)}
                      placeholder="Description..."
                      className="input-field w-full mb-2 text-sm"
                    />
                    {/* Resources */}
                    <div className="flex flex-wrap gap-1">
                      {node.resources.map(r => (
                        <span key={r.type} className="inline-flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-0.5 text-xs">
                          {r.type}
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={r.output}
                            onChange={e => updateResourceOutput(node.id, r.type, Number(e.target.value))}
                            className="w-8 bg-transparent text-center"
                          />
                          <button onClick={() => removeResource(node.id, r.type)} className="text-[var(--accent)] font-bold cursor-pointer">×</button>
                        </span>
                      ))}
                      <select
                        onChange={e => { if (e.target.value) addResource(node.id, e.target.value as ResourceType); e.target.value = '' }}
                        className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded-sm px-1"
                        defaultValue=""
                      >
                        <option value="">+ resource</option>
                        {RESOURCE_TYPES.filter(rt => !node.resources.some(r => r.type === rt)).map(rt => (
                          <option key={rt} value={rt}>{rt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add edge */}
          {nodes.length >= 2 && (
            <div className="card-military p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Add Connection (Edge)</h3>
              <div className="flex gap-2 items-center">
                <select value={edgeFrom} onChange={e => setEdgeFrom(Number(e.target.value))} className="input-field flex-1">
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                <span className="text-[var(--muted)]">↔</span>
                <select value={edgeTo} onChange={e => setEdgeTo(Number(e.target.value))} className="input-field flex-1">
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                <button onClick={addEdge} className="btn-primary px-4">Link</button>
              </div>
              {edges.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {edges.map(([a, b], i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-0.5 text-xs">
                      {nodes.find(n => n.id === a)?.name} ↔ {nodes.find(n => n.id === b)?.name}
                      <button onClick={() => removeEdge(i)} className="text-[var(--accent)] font-bold cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
            <button onClick={() => setStep(3)} disabled={nodes.length < 2} className="btn-primary flex-1">
              Next: Map Image
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Map Image */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="card-military p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Generated Prompt for Nano Banana</h3>
            <pre className="bg-[var(--surface)] border border-[var(--border)] rounded-sm p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
              {generatePrompt()}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(generatePrompt())}
              className="mt-3 text-xs font-bold text-[var(--sepia)] uppercase cursor-pointer hover:underline"
            >
              Copy to Clipboard
            </button>
          </div>

          <Field label="Upload Generated Map Image">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="input-field"
            />
          </Field>

          {mapPreviewUrl && (
            <div className="card-military p-2">
              <img src={mapPreviewUrl} alt="Map preview" className="w-full rounded-sm" />
              <p className="text-xs text-[var(--muted)] mt-2">CID: {mapCid}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1">Back</button>
            <button onClick={() => setStep(4)} disabled={!mapCid} className="btn-primary flex-1">
              Next: Position Nodes
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Position */}
      {step === 4 && (
        <div className="space-y-6">
          <p className="text-[var(--muted)]">Drag nodes to position them on the map.</p>

          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative w-full aspect-[16/9] border border-[var(--border)] rounded-sm overflow-hidden select-none cursor-default"
            style={{
              backgroundImage: mapPreviewUrl ? `url(${mapPreviewUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: 'var(--surface)',
            }}
          >
            {/* Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {edges.map(([a, b], i) => {
                const na = nodes.find(n => n.id === a)
                const nb = nodes.find(n => n.id === b)
                if (!na || !nb) return null
                return (
                  <line
                    key={i}
                    x1={na.position.x} y1={na.position.y}
                    x2={nb.position.x} y2={nb.position.y}
                    stroke="rgba(139,115,85,0.8)"
                    strokeWidth="0.4"
                  />
                )
              })}
            </svg>

            {/* Nodes */}
            {nodes.map(node => {
              const isDragged = dragging?.nodeId === node.id
              return (
                <div
                  key={node.id}
                  onMouseDown={e => handleMouseDown(e, node)}
                  className={`absolute w-8 h-8 rounded-full border-2 border-[var(--sepia)] bg-[var(--card)]/90 flex items-center justify-center text-xs font-bold ${
                    isDragged ? 'scale-125 z-40 border-[var(--accent)] cursor-grabbing' : 'cursor-grab hover:scale-110 hover:z-20'
                  }`}
                  style={{ left: `${node.position.x}%`, top: `${node.position.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  {node.id}
                </div>
              )
            })}

            {/* Labels */}
            {nodes.map(node => (
              <div
                key={`lbl-${node.id}`}
                className="absolute text-[8px] text-[var(--fg)] whitespace-nowrap pointer-events-none text-center drop-shadow-[0_1px_1px_rgba(244,236,225,0.9)]"
                style={{ left: `${node.position.x}%`, top: `${node.position.y + 3.5}%`, transform: 'translateX(-50%)' }}
              >
                {node.name}
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button onClick={() => setStep(3)} className="btn-secondary flex-1">Back</button>
            <button onClick={() => setStep(5)} className="btn-primary flex-1">
              Next: Review & Submit
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Submit */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="card-military p-6">
            <h3 className="text-lg font-bold uppercase tracking-wider mb-4">{name}</h3>
            <p className="text-[var(--muted)] mb-1">{region}</p>
            <p className="text-[var(--fg-secondary)] mb-4">{description}</p>

            <div className="stat-block mb-4">
              <div className="stat-item">
                <div className="stat-label">Nodes</div>
                <div className="stat-value">{nodes.length}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Edges</div>
                <div className="stat-value">{edges.length}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Map</div>
                <div className="stat-value">{mapCid ? 'Uploaded' : 'None'}</div>
              </div>
            </div>

            {lore && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-sm p-4 mb-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Lore</h4>
                <p className="text-[var(--fg-secondary)] leading-relaxed">{lore}</p>
              </div>
            )}

            <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Graph</h4>
            <div className="space-y-1 mb-4">
              {nodes.map(n => (
                <div key={n.id} className="flex items-center gap-3 text-sm">
                  <span className="font-bold">{n.name}</span>
                  <span className="text-[var(--sepia)] text-xs">{n.terrain}</span>
                  {n.resources.length > 0 && (
                    <span className="text-xs text-[var(--muted)]">
                      {n.resources.map(r => `${r.type}:${r.output}`).join(', ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card-military p-4 bg-[var(--surface)]">
            <p className="text-[var(--fg-secondary)] text-sm">
              This will submit the theatre as an on-chain transaction with the graph data and map CID.
            </p>
          </div>

          <div className="flex gap-4">
            <button onClick={() => setStep(4)} className="btn-secondary flex-1">Back</button>
            <button onClick={handleSubmit} className="btn-primary flex-1">
              Create Theatre
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-bold uppercase tracking-wider text-[var(--muted)] mb-2">{label}</label>
      {children}
    </div>
  )
}
