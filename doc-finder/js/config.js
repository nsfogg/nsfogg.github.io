// Where the encrypted vault lives. The repository should be private.
// These values are not secrets: nobody can read the repo without a GitHub token
// that has access to it, and the files in it are encrypted anyway.
export const CONFIG = {
  owner: 'nsfogg',
  repo: 'doc-finder',
  // Vault data is committed to its own branch so it never mixes with app code.
  branch: 'vault-data',
  // Lock the vault after this many minutes without activity.
  idleLockMinutes: 15,
  // Uploads go through the GitHub contents API as base64 JSON; keep files modest.
  maxUploadMB: 25,
};

export const CATEGORIES = [
  'Insurance',
  'Medical',
  'Financial',
  'Tax',
  'Legal',
  'Identity',
  'Housing',
  'Vehicle',
  'Military',
  'Education',
  'Employment',
  'Mail',
  'Receipts',
  'Other',
];
