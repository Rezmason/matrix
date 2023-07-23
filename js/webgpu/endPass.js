import { loadShader, makeBindGroup, makePass } from './utils.js'

// Eventually, WebGPU will allow the output of the final pass in the pipeline to be copied to the canvas texture.
// Until then, this render pass does the job.

const numVerticesPerQuad = 2 * 3

export default ({ device, canvasFormat, canvasContext }) => {
  const nearestSampler = device.createSampler()

  const renderPassConfig = {
    colorAttachments: [
      {
        // view: null,
        loadOp: 'clear',
        storeOp: 'store'
      }
    ]
  }

  let renderPipeline
  let renderBindGroup

  const assets = [loadShader(device, 'src/matrix/shaders/wgsl/endPass.wgsl')]

  const loaded = (async () => {
    const [imageShader] = await Promise.all(assets)

    renderPipeline = await device.createRenderPipelineAsync({
      layout: 'auto',
      vertex: {
        module: imageShader.module,
        entryPoint: 'vertMain'
      },
      fragment: {
        module: imageShader.module,
        entryPoint: 'fragMain',
        targets: [
          {
            format: canvasFormat
          }
        ]
      }
    })
  })()

  const build = (size, inputs) => {
    renderBindGroup = makeBindGroup(device, renderPipeline, 0, [
      nearestSampler,
      inputs.primary.createView()
    ])
    return null
  }

  const run = (encoder, shouldRender) => {
    if (!shouldRender) {
      return
    }

    renderPassConfig.colorAttachments[0].view = canvasContext.getCurrentTexture().createView()
    const renderPass = encoder.beginRenderPass(renderPassConfig)
    renderPass.setPipeline(renderPipeline)
    renderPass.setBindGroup(0, renderBindGroup)
    renderPass.draw(numVerticesPerQuad, 1, 0, 0)
    renderPass.end()
  }

  return makePass('End', loaded, build, run)
}
