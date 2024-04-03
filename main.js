const baseVS = `#version 300 es

precision highp float;

out vec2 vTexCoords;

void main() {
    vec2 coords = vec2(gl_VertexID % 2, gl_VertexID / 2);

    vTexCoords = coords;
    gl_Position = vec4(coords * 2. - 1., 0, 1);
}
`

const gridUpdateFS = `#version 300 es

precision highp float;
precision highp isampler2D;

uniform isampler2D uGrid;
uniform int uGridSize;

out int oCell;

void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    int neighbors =
        (texelFetch(uGrid, (c + ivec2(0,  1)) % uGridSize, 0).r & 1) +
        (texelFetch(uGrid, (c + ivec2(0, -1)) % uGridSize, 0).r & 1) +
        (texelFetch(uGrid, (c + ivec2( 1, 0)) % uGridSize, 0).r & 1) +
        (texelFetch(uGrid, (c + ivec2(-1, 0)) % uGridSize, 0).r & 1) +
        (texelFetch(uGrid, (c + ivec2( 1,  1)) % uGridSize, 0).r & 1) +
        (texelFetch(uGrid, (c + ivec2( 1, -1)) % uGridSize, 0).r & 1) +
        (texelFetch(uGrid, (c + ivec2(-1,  1)) % uGridSize, 0).r & 1) +
        (texelFetch(uGrid, (c + ivec2(-1, -1)) % uGridSize, 0).r & 1)
    ;

    int cell = texelFetch(uGrid, c, 0).r;

    oCell = ((cell << 1) | ((((cell & 1) == 0 && neighbors == 3) || ((cell & 1) == 1 && (neighbors == 2 || neighbors == 3))) ? 1 : 0)) & 0x7f;
}
`

const outVS = `#version 300 es

precision highp float;

uniform float uScale;

out vec2 vTexCoords;

void main() {
    vec2 coords = vec2(gl_VertexID % 2, gl_VertexID / 2);

    vTexCoords = coords / uScale;
    gl_Position = vec4(coords * 2. - 1., 0, 1);
}
`
const outFS = `#version 300 es

precision highp float;
precision highp isampler2D;

uniform isampler2D uTex;

uniform vec2 uPosition;
uniform float uScale;
uniform int uGridSize;
uniform int uScreenSize;

in vec2 vTexCoords;

out vec4 oColor;

void main() {
    int p = texture(uTex, vTexCoords + uPosition).r;

    float pixelSize = float(uScreenSize) * uScale / float(uGridSize);

    vec3 col = vec3(
        (p & 1) * 4 +
        ((p >> 1) & 1) /* +
        ((p >> 2) & 1) +
        ((p >> 3) & 1) +
        ((p >> 4) & 1) +
        ((p >> 5) & 1) +
        ((p >> 6) & 1) +
        ((p >> 7) & 1)*/
    ) / 4.;

    if (pixelSize > 5.0) {
        vec2 subCoords = 1. - abs(fract((vTexCoords + uPosition) * float(uGridSize)) * 2. - 1.);
        col *= min(subCoords.x, subCoords.y) > 0.1 ? 1.0 : 0.0;
    }

    oColor = vec4(col, 1);
}
`

/**
    * @param {WebGL2RenderingContext} gl
    * @param {number} type
    * @param {string} source
    * @returns {WebGLShader}
*/
function compileShader(gl, type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log(source.split('\n').map((s, i) => `${i + 1}: ${s}`).join('\n'))
        throw new Error('Could not compile shader: ' + gl.getShaderInfoLog(shader));
    }
    return shader

}

/**
    * @param {WebGL2RenderingContext} gl 
    * @param {WebGLShader} vShader 
    * @param {WebGLShader} fShader 
    * @returns {WebGLProgram}
*/
function createProgram(gl, vShader, fShader) {
    const program = gl.createProgram()
    gl.attachShader(program, vShader)
    gl.attachShader(program, fShader)

    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program))
    }
    return program
}

/**
    * @param {WebGL2RenderingContext} gl 
    * @param {number} width 
    * @param {number} height 
    * @returns {[WebGLTexture, WebGLTexture]}
*/
function createGridTextures(gl, width, height) {
    const texs = [
        gl.createTexture(),
        gl.createTexture(),
    ]

    const pixels = new Int8Array(width * height).map(_ => Math.random() < 0.4 ? 0x7f : 0)

    gl.bindTexture(gl.TEXTURE_2D, texs[0])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8I, width, height, 0, gl.RED_INTEGER, gl.BYTE, pixels)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

    gl.bindTexture(gl.TEXTURE_2D, texs[1])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8I, width, height, 0, gl.RED_INTEGER, gl.BYTE, pixels)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

    return texs
}

function main() {
    const canvas = document.querySelector('canvas')

    canvas.width = 512
    canvas.height = 512

    const gl = canvas.getContext('webgl2')


    const gridSize = 512

    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]))


    const shaders = {
        baseVS: compileShader(gl, gl.VERTEX_SHADER, baseVS),
        gridUpdateFS: compileShader(gl, gl.FRAGMENT_SHADER, gridUpdateFS),
        outVS: compileShader(gl, gl.VERTEX_SHADER, outVS),
        outFS: compileShader(gl, gl.FRAGMENT_SHADER, outFS),
    }

    const outProgram = createProgram(gl, shaders.outVS, shaders.outFS)
    gl.useProgram(outProgram)
    gl.uniform1i(gl.getUniformLocation(outProgram, 'uTex'), 0)
    const outUScaleLoc = gl.getUniformLocation(outProgram, 'uScale')
    const outUPositionLoc = gl.getUniformLocation(outProgram, 'uPosition')
    gl.uniform1i(gl.getUniformLocation(outProgram, 'uGridSize'), gridSize)
    gl.uniform1i(gl.getUniformLocation(outProgram, 'uScreenSize'), gl.canvas.height)

    const gridUpdateProgram = createProgram(gl, shaders.baseVS, shaders.gridUpdateFS)
    gl.useProgram(gridUpdateProgram)
    gl.uniform1i(gl.getUniformLocation(gridUpdateProgram, 'uGrid'), 0)
    gl.uniform1i(gl.getUniformLocation(gridUpdateProgram, 'uGridSize'), gridSize)

    const grids = createGridTextures(gl, gridSize, gridSize)

    const updateFrameBuffer = gl.createFramebuffer()

    let position = new Float32Array([0, 0])

    let paused = true

    let scale = 2
    let moving = false

    canvas.addEventListener('wheel', (e) => {
        const scalePrev = scale
        const rect = canvas.getBoundingClientRect()

        const mX = (e.clientX - rect.x) / rect.width
        const mY = 1 - (e.clientY - rect.y) / rect.height

        scale = Math.min(gridSize, Math.max(2, scale * (1 - e.deltaY / 120)))

        position[0] = -mX / scale + position[0] + mX / scalePrev
        position[1] = -mY / scale + position[1] + mY / scalePrev
    })
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            moving = true
        }
    })
    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            moving = false
        }
    })
    document.addEventListener('mousemove', (e) => {
        if (moving) {
            position[0] -= e.movementX / gl.canvas.height / scale
            position[1] += e.movementY / gl.canvas.height / scale
        }
    })

    /** @type {HTMLButtonElement} */
    const playButton = document.querySelector('#playButton')
    playButton.addEventListener('click', (e) => {
        if (e.target.innerText === 'PLAY') {
            paused = false
            e.target.innerText = 'PAUSE'
        }
        else {
            paused = true
            e.target.innerText = 'PLAY'
        }
    })

    /** @type {HTMLInputElement} */
    const speedRange = document.querySelector('#speedRange')



    let time = 0
    let then = 0
    let frame = 0

    function render(now) {
        now /= 1000
        const deltaTime = Math.min(1/12, now - then)
        then = now

        if (paused === false) {
            time += deltaTime * speedRange.value
        }

        while (frame < Math.floor(time)) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, updateFrameBuffer)
            gl.viewport(0, 0, gridSize, gridSize)

            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, grids[frame % 2])

            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, grids[(frame + 1) % 2], 0)
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
                let mess
                for (const k in gl) {
                    if (gl[k] === status) {
                        mess = k
                        break
                    }
                }
                throw new Error(mess)
            }

            gl.useProgram(gridUpdateProgram)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

            frame++
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, grids[frame % 2])

        gl.useProgram(outProgram)
        gl.uniform2fv(outUPositionLoc, position)
        gl.uniform1f(outUScaleLoc, scale)

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        requestAnimationFrame(render)
    }
    requestAnimationFrame(render)
}

main()
