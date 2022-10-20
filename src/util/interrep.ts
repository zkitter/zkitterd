import Web3 from 'web3';
import { interrepABI } from './abi';
import config from './config';

const httpProvider = new Web3.providers.HttpProvider(
  'https://kovan.infura.io/v3/4ccf3cd743eb42b5a8cb1c8b0c0160ee'
);
const web3 = new Web3(httpProvider);
const interrep = new web3.eth.Contract(interrepABI as any, config.interrepContract);

export default interrep;
