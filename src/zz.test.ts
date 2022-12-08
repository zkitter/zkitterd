import tape from 'tape';

tape('EXIT', t => {
  t.end();
  process.exit(0);
});
