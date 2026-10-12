/** Where transformer models run: the GPU when the browser has WebGPU, else WebAssembly on the CPU. */
export type AIBackend = 'webgpu' | 'wasm' | 'none';

/** The parts of `navigator` detection reads; WebGPU is not in every TypeScript DOM lib yet. */
interface GpuNavigator {
	gpu?: { requestAdapter(): Promise<unknown> };
}

/**
 * Picks the fastest backend this device supports. WebGPU counts only when an adapter
 * is actually granted (some browsers expose `navigator.gpu` with no usable GPU).
 */
export async function detectBackend(
	nav: GpuNavigator | undefined = globalThis.navigator as GpuNavigator | undefined,
	hasWasm: boolean = typeof WebAssembly === 'object'
): Promise<AIBackend> {
	if (nav?.gpu) {
		try {
			if (await nav.gpu.requestAdapter()) return 'webgpu';
		} catch {
			// A refused adapter means no WebGPU; fall through to WebAssembly.
		}
	}
	return hasWasm ? 'wasm' : 'none';
}
