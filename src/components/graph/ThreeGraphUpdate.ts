import ForceGraph3D from '3d-force-graph';
import chroma from 'chroma-js';
import type { ForceGraph3DInstance } from '3d-force-graph';
import type { GraphData, Node, Link } from '$lib/types';
import type { Renderer } from 'three';
import {
    CSS3DRenderer,
    CSS3DSprite
} from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { Vector2, Vector3 } from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
// import { focusedArticleId } from '$lib/stores/stores';
// import SpriteText from "three-spritetext";

type Settings = { [key: string]: number };

const defaultForce3DSettings: Settings = {
    attraction: 1,
    repulsion: 1,
    gravity: 1
}

let layoutSettings: { [key: string]: number } = getSettings();

let graphInstance: ForceGraph3DInstance;
const graphData: GraphData = { nodes: [], links: [] };




function initializeGraph(container: HTMLElement) {
    graphInstance = ForceGraph3D({
        extraRenderers: [new CSS3DRenderer() as unknown as Renderer]
    })(container)
        .backgroundColor('#000000')
        // .nodeColor('color')
        // .nodeLabel('title')

        .nodeThreeObject(node => {
            const nodeEl = document.createElement('div');
            const nodeTitle = (node as { title: string }).title;
            const nodeText = (node as { text: string }).text as string;
            nodeEl.innerHTML = `<h3>${nodeTitle}</h3>${nodeText}`;
            nodeEl.className = 'node-label';

            // Style adjustments
            nodeEl.style.background = chroma((node as { color: string }).color).alpha(0.77).css();
            // nodeEl.style.background = 'rgba(0, 0, 0, 0.7)'; // Optional: Add background to enhance readability
            nodeEl.style.padding = '10px'; // Optional: Add some padding
            nodeEl.style.borderRadius = '5px'; // Optional: Round corners
            nodeEl.style.color = '#000'; // Optional: Text color
            // Ensure the text wraps and is fully visible
            nodeEl.style.whiteSpace = 'normal';
            nodeEl.style.textAlign = 'left'; // Align text for readability
            nodeEl.style.fontSize = '14px'; // Adjust font size as needed
            nodeEl.style.maxWidth = '1000px'; // Limit the width of the node element
            // Resize images that are larger than maxWidth
            const images = nodeEl.querySelectorAll('img');
            images.forEach(img => {
                img.style.maxWidth = '100%'; // Make sure images do not exceed the node element's width
                img.style.height = 'auto'; // Maintain aspect ratio
            });

            document.body.appendChild(nodeEl); // Temporarily add to DOM to measure
            const nodeHeight = nodeEl.offsetHeight; // Get the rendered height
            document.body.removeChild(nodeEl); // Remove from DOM after measuring

            nodeEl.addEventListener('wheel', (event) => {
                const ZOOM_INTENSITY = 0.15; // Adjust this value to control the zoom intensity
                const MIN_DISTANCE = 30; // Minimum distance to the node
                const MAX_DISTANCE = 1000; // Maximum distance to the node
                const zoomIn = event.deltaY < 0; // Determine zoom direction

                const currentCameraPos = graphInstance.camera().position;
                const nodePosition = node as { x: number; y: number; z: number };

                const vectorToNode = {
                    x: nodePosition.x - currentCameraPos.x,
                    y: nodePosition.y - currentCameraPos.y,
                    z: nodePosition.z - currentCameraPos.z
                };

                const currentDistance = Math.sqrt(vectorToNode.x ** 2 + vectorToNode.y ** 2 + vectorToNode.z ** 2);

                let targetDistance = zoomIn ? currentDistance * (1 - ZOOM_INTENSITY) : currentDistance * (1 + ZOOM_INTENSITY);
                targetDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, targetDistance));

                const normalizedVectorToNode = {
                    x: vectorToNode.x / currentDistance,
                    y: vectorToNode.y / currentDistance,
                    z: vectorToNode.z / currentDistance
                };

                const targetPos = {
                    x: nodePosition.x - normalizedVectorToNode.x * targetDistance,
                    y: nodePosition.y - normalizedVectorToNode.y * targetDistance,
                    z: nodePosition.z - normalizedVectorToNode.z * targetDistance
                };

                graphInstance.cameraPosition(targetPos, nodePosition, 0);
            }, true);

            // nodeEl.addEventListener('click', () => {
            //     // console.log('click', event);
            //     const clickedNode = node as { x: number; y: number; z: number };
            //     const distance = 144;
            //     const distRatio = 1 + distance / Math.hypot(clickedNode.x, clickedNode.y, clickedNode.z);

            //     const newPos = (clickedNode).x || clickedNode.y || clickedNode.z
            //         ? { x: clickedNode.x * distRatio, y: clickedNode.y * distRatio, z: clickedNode.z * distRatio }
            //         : { x: 0, y: 0, z: distance };

            //     graphInstance.cameraPosition(
            //         newPos,
            //         clickedNode,
            //         10
            //     );
            // }, true);


            let isDragging = false;
            let dragStart: { x: number; y: number; time: number } | null = null;
            let lastDragPosition: { x: number; y: number } | null = null;

            const onMouseDown = (event: MouseEvent) => {
                isDragging = true;
                dragStart = { x: event.clientX, y: event.clientY, time: Date.now() };
                lastDragPosition = { x: event.clientX, y: event.clientY };
                console.log('MouseDown', dragStart);
                event.preventDefault(); // Prevent text selection, etc.
            };

            const onMouseMove = (event: MouseEvent) => {
                if (isDragging && dragStart) {
                    const deltaX = event.clientX - (lastDragPosition?.x || event.clientX);
                    const deltaY = event.clientY - (lastDragPosition?.y || event.clientY);
                    lastDragPosition = { x: event.clientX, y: event.clientY };

                    if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
                        const sensitivity = 0.5; // Adjust based on desired scrolling speed

                        // Get the camera
                        const camera = graphInstance.camera();

                        // Calculate the right and up vectors for the camera
                        const cameraDirection = new Vector3();
                        camera.getWorldDirection(cameraDirection);
                        const cameraRight = new Vector3();
                        cameraRight.crossVectors(camera.up, cameraDirection).normalize();
                        const cameraUp = new Vector3();
                        cameraUp.crossVectors(cameraDirection, cameraRight).normalize();

                        // Calculate movement deltas
                        const moveRight = cameraRight.multiplyScalar(deltaX * sensitivity);
                        const moveUp = cameraUp.multiplyScalar(deltaY * sensitivity);

                        // Calculate the new camera position
                        const newPosition = new Vector3().addVectors(camera.position, moveRight).add(moveUp);

                        // Use graphInstance.cameraPosition to update the camera
                        graphInstance.cameraPosition(
                            newPosition, // New position
                            { x: newPosition.x + cameraDirection.x, y: newPosition.y + cameraDirection.y, z: newPosition.z + cameraDirection.z }, // LookAt: Maintain focus in the same direction
                            0 // Immediate transition
                        );
                    }
                }
            };

            const onMouseUp = (event: MouseEvent) => {
                if (!dragStart) return; // Ensure dragStart is initialized
                console.log('MouseUp', { x: event.clientX, y: event.clientY });
                const timeElapsed = Date.now() - dragStart.time;

                if (isDragging && timeElapsed > 200) { // Consider it a drag if the time elapsed is more than 200ms
                    // Drag end logic here (if any)
                } else {
                    // It's a click
                    console.log('Click detected');
                    const clickedNode = node as { x: number; y: number; z: number };
                    const distance = 85;
                    const distRatio = 1 + distance / Math.hypot(clickedNode.x, clickedNode.y, clickedNode.z);

                    const newPos = (clickedNode).x || clickedNode.y || clickedNode.z
                        ? {
                            x: clickedNode.x * distRatio,
                            y: clickedNode.y * distRatio,
                            z: clickedNode.z * distRatio
                        }
                        : { x: 0, y: 0, z: distance };

                    graphInstance.cameraPosition(
                        newPos,
                        undefined,
                        500
                    );
                }

                isDragging = false;
                dragStart = null;
                lastDragPosition = null;
            };

            nodeEl.addEventListener('mousedown', onMouseDown, true);
            window.addEventListener('mousemove', onMouseMove, true);
            window.addEventListener('mouseup', onMouseUp, true);

            const sprite = new CSS3DSprite(nodeEl);
            sprite.scale.set(0.1, 0.1, 0.1);
            return sprite;
        })

        // .nodeThreeObject(node => {
        //     const sprite = new SpriteText((node as { title: string }).title);
        //     sprite.material.depthWrite = false; // make sprite background transparent
        //     sprite.color = (node as { color: string }).color;
        //     sprite.textHeight = 8;
        //     return sprite;
        // })

        // .nodeThreeObjectExtend(true)
        // .linkCurveRotation('rotation')
        .linkCurvature(parseFloat('weight'))
        .linkOpacity(parseFloat('weight'))
        .linkColor('color')
        .width(window.innerWidth)
        .height(window.innerHeight)
        .graphData(graphData)

    const bloomPass = new UnrealBloomPass(
        new Vector2(window.innerWidth, window.innerHeight),
        0.1, 10, 0
    );
    window.addEventListener('resize', () => {
        bloomPass.setSize(window.innerWidth, window.innerHeight);
        graphInstance
            .width(window.innerWidth)
            .height(window.innerHeight)
    })
    graphInstance.postProcessingComposer().addPass(bloomPass);
}

function addNodes(nodes: Node[]) {
    graphData.nodes.push(...nodes);
    graphInstance.graphData(graphData);
}

function addLinks(links: Link[]) {
    for (const link of links) graphData.links.push(link);
    graphInstance.graphData(graphData);
}

function removeNodesById(nodeIds: Set<string>) {
    graphData.nodes = graphData.nodes.filter(node => !nodeIds.has(node.id));
    graphData.links = graphData.links.filter(link => !nodeIds.has(link.source) && !nodeIds.has(link.target));
    graphInstance.graphData(graphData);
}


function addBoth(graphData: GraphData) {
    if (graphData.nodes.length > 0) addNodes(graphData.nodes);
    if (graphData.links.length > 0) addLinks(graphData.links);
}

function clearGraph() {
    graphData.nodes = [];
    graphData.links = [];
    graphInstance.graphData(graphData);
}

function redrawLinks(links: Link[]) {
    if (links.length > 0) {
        const copiedLinks = structuredClone(links);
        graphData.links = [];
        addLinks(copiedLinks);
    }
}


function updateForceSettings(newSettings: Settings) {
    layoutSettings = { ...layoutSettings, ...newSettings };
    saveCurrentSettings();
    graphInstance.d3Force('link')?.distance(layoutSettings.repulsion * 1000);
    graphInstance.d3Force('charge')?.strength(layoutSettings.attraction * 1000);
    graphInstance.d3Force('center')?.strength(layoutSettings.gravity * 1000);
    graphInstance.numDimensions(3);
}

function getSettings() {
    const settings = localStorage.getItem('layoutForce3DSettings');
    return settings ? JSON.parse(settings) : defaultForce3DSettings;
}


function saveCurrentSettings() {
    localStorage.setItem('layoutForce3DSettings', JSON.stringify(layoutSettings));
}

function dummy() { }

export {
    addBoth as addAll,
    addBoth,
    redrawLinks,
    clearGraph,
    initializeGraph,
    addNodes,
    addLinks,
    removeNodesById,
    dummy as switchLayout,
    dummy as updateDayNightMode,
    updateForceSettings
};