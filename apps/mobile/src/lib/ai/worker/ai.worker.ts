import { expose } from 'comlink';
import { MODELS } from '../registry.js';
import { createWorkerApi } from './api.js';

// Model downloads and (from T10.4 on) all ML run here, never on the UI thread.
expose(
	createWorkerApi({ caches: self.caches, fetch: self.fetch.bind(self) }, () =>
		MODELS.map((model) => model.id)
	)
);
