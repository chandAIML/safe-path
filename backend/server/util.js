const REL = ['Mother', 'Father', 'Friend', 'Sibling', 'Husband', 'Other'];
// Accepts 98765 43210, +91 98765 43210, 098765 43210 -> "9876543210"
const normPhone = v => {
  v = String(v || '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(v) ? v : null;
};
const validEmail = v => typeof v === 'string' && v.length <= 120 && /^\S+@\S+\.\S+$/.test(v);

// Validates one emergency contact. Returns {value} or {error}.
function cleanContact(c, ownPhone, existing) {
  const name = String((c && c.name) || '').trim();
  const phone = normPhone(c && c.phone);
  if (name.length < 2 || name.length > 60) return { error: 'Enter the contact’s name.' };
  if (!phone) return { error: 'Enter a valid 10-digit mobile number.' };
  if (phone === ownPhone) return { error: 'That’s your own number. Add someone else.' };
  if (existing.some(x => x.phone === phone)) return { error: 'This number is already added.' };
  return { value: { name, phone, rel: REL.includes(c.rel) ? c.rel : 'Other' } };
}
module.exports = { normPhone, validEmail, cleanContact };
