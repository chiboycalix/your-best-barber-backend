import { Router } from 'express';
import authRoute from './auth.route';

const router = Router();

const defaultRoutes = [{path: '/auth', route: authRoute}];

defaultRoutes.forEach((route) => {
    router.use(route.path, route.route);
});

export default router;