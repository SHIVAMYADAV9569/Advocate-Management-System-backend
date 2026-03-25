const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole, clientOwnData } = require('../middleware/rbac');
const {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientStats
} = require('../controllers/clientController');

router.use(protect);

router.route('/')
  .get(getClients)
  .post(checkRole('admin', 'lawyer'), createClient);

router.route('/stats')
  .get(getClientStats);

router.route('/:id')
  .get(getClient)
  .put(checkRole('admin', 'lawyer'), updateClient)
  .delete(checkRole('admin'), deleteClient);

module.exports = router;
