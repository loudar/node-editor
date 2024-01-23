import {FjsObservable} from "https://fjs.targoninc.com/f.js";
import {ValueTypes} from "./value-types.mjs";
import {EditorNode} from "./editor-node.mjs";
import {NodeField} from "./node-field.mjs";
import {NodeType} from "./node-type.mjs";
import {DefaultEditorSettings} from "./default-editor-settings.mjs";

export class NodeEditor {
    static create(types = [], nodes = []) {
        return new NodeEditor(types, nodes);
    }

    constructor(types = [], nodes = [], settings = DefaultEditorSettings) {
        this.nodeTypes = types;
        this.nodes = nodes;
        this.position = new FjsObservable({x: 0, y: 0});
        this.zoomState = new FjsObservable(1);
        window.nodeEditor = this;
        this.settings = settings;
        this.rerender = () => {
            console.log("rerender method is not set. Make sure your renderer is set up correctly.");
        };
    }

    setRenderer(method) {
        this.rerender = method;
    }

    addNodeType(type) {
        this.nodeTypes.push(type);
    }

    updateNodeType(type) {
        this.nodeTypes = this.nodeTypes.map(t => t.name === type.name ? type : t);
    }

    removeNodeTypeByName(name) {
        this.nodeTypes = this.nodeTypes.filter(type => type.name !== name);
        this.removeNodesByType(name);
    }

    getNodesByType(type) {
        return this.nodes.filter(node => node.type === type);
    }

    /**
     *
     * @param node {EditorNode}
     */
    addNode(node) {
        this.nodes.push(node);
    }

    /**
     *
     * @param name {string}
     */
    removeNodeByName(name) {
        this.nodes = this.nodes.filter(node => node.name !== name);
    }

    /**
     *
     * @param id {string}
     */
    removeNodeById(id) {
        this.nodes = this.nodes.filter(node => node.id !== id);
        for (const node of this.nodes) {
            node.connections = node.connections.filter(connection => connection.to !== id);
        }
    }

    /**
     *
     * @param type {string}
     */
    removeNodesByType(type) {
        this.nodes = this.nodes.filter(node => node.type.name !== type);
    }

    startConnection(fromId) {
        const sourceNode = this.nodes.find(node => node.id === fromId);
        for (const node of this.nodes) {
            if (node.id !== fromId) {
                if (sourceNode.canConnectTo(node.id)) {
                    node.highlightAsConnectionTarget();
                }
            } else {
                node.highlightAsConnectionSource();
            }
        }
    }

    finishConnection(fromId, toId) {
        for (const node of this.nodes) {
            if (node.id !== fromId) {
                node.unhighlightAsConnectionTarget();
            } else {
                node.unhighlightAsConnectionSource();
            }
        }
        if (!toId) {
            return;
        }
        const fromNode = this.nodes.find(node => node.id === fromId);
        const toNode = this.nodes.find(node => node.id === toId);
        if (this.settings.preventCircularConnections) {
            if (this.connectionWouldRecurse(fromNode, toNode)) {
                console.log("Connection would recurse. Not connecting.");
                return;
            }
        }
        fromNode.connect(toNode.id);
        this.rerender();
    }

    connectionWouldRecurse(fromNode, toNode) {
        if (fromNode.id === toNode.id) {
            return true;
        }
        for (const connection of toNode.connections) {
            if (this.connectionWouldRecurse(fromNode, this.nodes.find(node => node.id === connection.to))) {
                return true;
            }
        }
        return false;
    }

    resetPosition() {
        this.position.value = {x: 0, y: 0};
    }

    openContextMenu(e, menuClassState, menuPositionState, rerenderCallback) {
        if (e.target.id !== "node-editor" && e.target.id !== "node-editor-nodes") {
            return;
        }
        e.preventDefault();
        menuClassState.value = menuClassState.value === 'hidden' ? '_' : 'hidden';
        menuPositionState.value = {x: e.clientX, y: e.clientY};
        document.addEventListener("click", () => {
            menuClassState.value = 'hidden';
            rerenderCallback();
        }, {once: true});
    }

    moveOffset(e) {
        if (e.target.id !== "node-editor" && e.target.id !== "node-editor-nodes") {
            return;
        }
        const mouseStart = {
            x: e.clientX,
            y: e.clientY
        };
        const editorStart = {
            x: this.position.value.x,
            y: this.position.value.y
        };
        const move = e => {
            this.position.value = {
                x: editorStart.x + e.clientX - mouseStart.x,
                y: editorStart.y + e.clientY - mouseStart.y
            };
        };
        const stop = () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", stop);
        };
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", stop);
    }

    zoom(e) {
        const direction = e.deltaY > 0 ? -1 : 1;
        const zoom = this.zoomState.value + direction * 0.1;
        if (zoom < 0.1) {
            return;
        }

        this.zoomState.value = zoom;
        this.rerender();
    }

    addNodeFromMenu(positionState, editorSize) {
        const position = {
            x: (positionState.value.x / this.zoomState.value) - editorSize.width / (2 * this.zoomState.value),
            y: (positionState.value.y / this.zoomState.value) - editorSize.height / (2 * this.zoomState.value)
        };
        this.addNode(new EditorNode(this.nodeTypes[0], position));
    }

    static fromJSON(parse) {
        const types = parse.nodeTypes.map(type => new NodeType(type.name, type.fields.map(field => {
            const fieldType = Object.values(ValueTypes).find(type => type.name === field.type.name);
            return new NodeField(field.name, fieldType, field.default, field.required, field.shown, field.id);
        })));
        const nodes = parse.nodes.map(node => {
            const type = types.find(type => type.name === node.type.name);
            return new EditorNode(type, node.position, node.values, node.id, node.connections);
        });
        return new NodeEditor(types, nodes);
    }
}

