// Emergency contacts (max 5, first one is "primary" and also gets a phone call).
const express = require('express');
const { Contact, contactsOf, mongoose } = require('./db');
const { requireAuth } = require('./auth');
const { cleanContact } = require('./util');
const router = express.Router();
router.use(requireAuth);

const out = async uid => ({ contacts: (await contactsOf(uid)).map(c => ({ id: c.id, name: c.name, phone: c.phone, rel: c.rel })) });
const find = (list, id) => (mongoose.isValidObjectId(id) ? list.find(c => c.id === id) : undefined);

router.get('/', async (req, res) => res.json(await out(req.user.id)));

router.post('/', async (req, res) => {
  const list = await contactsOf(req.user.id);
  if (list.length >= 5) return res.status(400).json({ error: 'You can add up to 5 contacts.' });
  const r = cleanContact(req.body, req.user.phone, list);
  if (r.error) return res.status(400).json({ error: r.error });
  await Contact.create({ ...r.value, userId: req.user._id, order: list.length ? list[list.length - 1].order + 1 : 0 });
  res.status(201).json(await out(req.user.id));
});

router.delete('/:id', async (req, res) => {
  const list = await contactsOf(req.user.id);
  const c = find(list, req.params.id);
  if (!c) return res.status(404).json({ error: 'Contact not found.' });
  if (list.length <= 1) return res.status(400).json({ error: 'Keep at least one emergency contact.' });
  await c.deleteOne();
  res.json(await out(req.user.id));
});

router.put('/:id/primary', async (req, res) => {
  const list = await contactsOf(req.user.id);
  const c = find(list, req.params.id);
  if (!c) return res.status(404).json({ error: 'Contact not found.' });
  c.order = list[0].order - 1; await c.save();
  res.json(await out(req.user.id));
});

module.exports = { router };
