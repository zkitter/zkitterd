import express, { Router } from 'express';
import _path from 'path';

const path = (...args: string[]) => _path.join(process.cwd(), 'static', ...args);

const router = Router();

console.log(path('semaphore_final.zkey'));
router.use('/dev/semaphore_wasm', express.static(path('semaphore.wasm')));
router.use('/dev/semaphore_final_zkey', express.static(path('semaphore_final.zkey')));
router.use('/dev/semaphore_vkey', express.static(path('verification_key.json')));
router.use('/circuits/semaphore/wasm', express.static(path('semaphore', 'semaphore.wasm')));
router.use('/circuits/semaphore/zkey', express.static(path('semaphore', 'semaphore_final.zkey')));
router.use('/circuits/semaphore/vkey', express.static(path('semaphore', 'verification_key.json')));
router.use('/circuits/rln/wasm', express.static(path('rln', 'rln.wasm')));
router.use('/circuits/rln/zkey', express.static(path('rln', 'rln_final.zkey')));
router.use('/circuits/rln/vkey', express.static(path('rln', 'verification_key.json')));

export { router as staticRouter };
