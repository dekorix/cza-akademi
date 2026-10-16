import { api } from '@appdeploy/client';
import { captureChildAccessFromLocation, installChildAccessHeader } from './childAccessMemory';

installChildAccessHeader(api as never);
captureChildAccessFromLocation();
