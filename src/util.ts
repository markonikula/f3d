import * as THREE from 'three';

interface ShaderMap {
    [key: string]: string
}

async function loadShaderMap<T extends ShaderMap>(shaderFiles: T): Promise<T> {
    const loader = new THREE.FileLoader();
    const shaderMap: ShaderMap = {};
    const includes: ShaderMap = {};
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
        shaderMap[name] = data;
    }
    return shaderMap as T;
}

function findIncludedFilenames(str: string) {
    return [...str.matchAll(/^#include <(.*)>$/gm)]
        .map(match => match[1]);
}

export { loadShaderMap };
