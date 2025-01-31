import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

interface ShaderMap {
    [key: string]: string
}

async function loadShaderMap<T extends ShaderMap>(shaderFiles: T): Promise<[T, Gui]> {
    const loader = new THREE.FileLoader();
    const shaderMap: ShaderMap = {};
    const includes: ShaderMap = {};
    const configParameters: ConfigParameterMap = {};
    for (const [name, filename] of Object.entries(shaderFiles)) {
        var data = await loader.loadAsync(`/public/shader/${filename}`) as string;
        // Strip the version definition - we want to have it there for the GLSL
        // syntax highlighting in Visual Studio Code, but Three.js prepends the
        // code with its own version definition and some other defines.
        data = data.replace(/#version .*\n/, "");
        const includedFilenames = findIncludedFilenames(data);
        for (const inc of includedFilenames) {
            var incData = includes[inc];
            if (!incData) {
                incData = await loader.loadAsync(`/public/shader/${inc}`) as string;
                includes[inc] = incData;
            }
            data = data.replace(new RegExp(`^#include <${inc}>$`, "gm"), incData);
        }
        parseConfigParameters(configParameters, data);
        shaderMap[name] = data;
    }
    const gui = new Gui(configParameters);

    return [shaderMap as T, gui];
}

function findIncludedFilenames(str: string) {
    return [...str.matchAll(/^#include <(.*)>$/gm)]
        .map(match => match[1]);
}

function parseConfigParameters(map: ConfigParameterMap, data: string) {
    data.matchAll(/\/\/: (.+)\n(.+)\n/gm).forEach(match => {
        const [type, name] = parseConfigParameterVariable(match[2]);
        const definition = type === 'vec3'
            ? parseConfigParameterCommentForColor(name, type, match[1])
            : parseConfigParameterComment(name, type, match[1]);
        map[name] = definition;
    });
}

interface ConfigParameterMap {
    [key: string]: ConfigParameterDefinition
}

interface ConfigParameterDefinition {
    name: string,
    type: string,
    help: string,
    minValue: number,
    maxValue: number,
    defaultValue: number | number[]
}

function parseConfigParameterComment(name: string, type: string, s: string): ConfigParameterDefinition {
    const result = s.match(/^(.+),\s?default ([\d.]+),\s?([\d.]+)\s?-\s?([\d.]+)$/);
    if (!result) {
        throw new Error(`Invalid config parameter definition: ${s}`);
    }
    const defaultValue = parseFloat(result[2]);
    return {
        name,
        type,
        help: result[1],
        minValue: parseFloat(result[3]),
        maxValue: parseFloat(result[4]),
        defaultValue: defaultValue
    };
}

function parseConfigParameterCommentForColor(name: string, type: string, s: string): ConfigParameterDefinition {
    const result = s.match(/^(.+),\s?default \[([\d.]+),\s?([\d.]+),\s?([\d.]+)\]$/);
    if (!result) {
        throw new Error(`Invalid config parameter definition: ${s}`);
    }
    const df1 = parseFloat(result[2]);
    const df2 = parseFloat(result[3]);
    const df3 = parseFloat(result[4]);
    return {
        name,
        type,
        help: result[1],
        minValue: 0,
        maxValue: 0,
        defaultValue: [df1, df2, df3]
    };
}

function parseConfigParameterVariable(s: string): [string, string] {
    const result = s.match(/^uniform (.+) (.+);$/);
    if (!result) {
        throw new Error(`Invalid config parameter variable: ${s}`);
    }
    return [result[1], result[2]];
}

class Gui {
    values: { [key: string]: any };
    configMap;
    controls: { [key: string]: {[key: string]: any} };

    constructor(configMap: ConfigParameterMap) {
        this.values = {};
        this.configMap = configMap;
        const gui = new GUI();
        this.controls = {};

        const rendering = gui.addFolder('Rendering');
        for (const [name, definition] of Object.entries(configMap)) {
            this.addControl(rendering, name, definition);
        }
    }

    private addControl(group: any, property: string, definition: ConfigParameterDefinition) {
        const groupName = group._title.toLowerCase();
        const controlMap = (this.controls[groupName] ||= {});
        const object = this.values; //this.groups[groupName];
        object[property] = definition.defaultValue;
        var control;
        if (definition.type === 'vec3') {
            control = group.addColor(object, property);
        } else {
            control = group.add(object, property, definition.minValue, definition.maxValue);
        }
        controlMap[property] = control;
    }

    updateParameters(targetMap: any) {
        for (const [name, definition] of Object.entries(this.configMap)) {
            if (!targetMap[name]) {
                targetMap[name] = {};
            }
            targetMap[name].value = this.values[name];
        }
        return targetMap;
    }
}

export { loadShaderMap, Gui };
