import { readEnv } from '@fridge/config';

const loadAppConfig = () => readEnv(process.env);

export { loadAppConfig };
