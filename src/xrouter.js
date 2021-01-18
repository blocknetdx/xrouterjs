// // These constants define the application version and follow the semantic
// // versioning 2.0.0 spec (http://semver.org/).
// const appMajor = 4;
// const appMinor = 2;
// const appPatch = 1;

// // appPreRelease MUST only contain characters from semanticAlphabet
// // per the semantic versioning spec.
// const appPreRelease = 'beta';

// // semanticAlphabet
// const semanticAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-';

// // XRouter namespaces
// const xr = 'xr';
// const xrs = 'xrs';
// const xrd = 'xrd';
// const xrdelim = '::';

// // XRouter SPV calls
// const xrGetBlockCount = 'xrGetBlockCount';
// const xrGetBlockHash = 'xrGetBlockHash';
// const xrGetBlock = 'xrGetBlock';
// const xrGetBlocks = 'xrGetBlocks';
// const xrGetTransaction = 'xrGetTransaction';
// const xrGetTransactions = 'xrGetTransactions';
// const xrDecodeTransaction = 'xrDecodeTransaction';
// const xrSendTransaction = 'xrSendTransaction';

// // XRouter Non-SPV calls
// const xrsService = 'xrService';

// // xrNS return the XRouter namespace with delimiter.
// const xrNS = (ns) => ns + xrdelim;

// // isNS returns true if the service matches the namespace.
// const isNS = (service, ns) => {
//   const prefix = xrNS(ns);
//   return service.substring(0, prefix.length) === prefix;
// };

// // normalizeVerString returns the passed string stripped of all characters which
// // are not valid according to the semantic versioning guidelines for pre-release
// // version and build metadata strings.  In particular they MUST only contain
// // characters in semanticAlphabet.
// const normalizeVerString = (str) => {
//   let result = '';
//   for (let i = 0; i < str.length; i += 1) {
//     if (semanticAlphabet.includes(str[i])) {
//       result += str[i];
//     }
//   }

//   return result;
// };

// // version returns the application version as a properly formed string per the
// // semantic versioning 2.0.0 spec (http://semver.org/).
// const version = () => {
//   // Start with the major, minor, and patch versions.
//   let versions = `${appMajor}.${appMinor}.${appPatch}`;

//   // Append pre-release version if there is one.  The hyphen called for
//   // by the semantic versioning spec is automatically appended and should
//   // not be contained in the pre-release string.  The pre-release version
//   // is not appended if it contains invalid characters.
//   const preRelease = normalizeVerString(appPreRelease);
//   if (preRelease !== '') {
//     versions += `-${preRelease}`;
//   }

//   return versions;
// };

// const cfg = {
// 	MaxPeers: 125,
// 	SimNet: false,
// 	DisableBanning: false,
// 	BanThreshold: 100,
// 	BanDuration: 3600 * 24,
// 	DataDir: '.',
// 	AddPeers: [],
// 	ConnectPeers: [],
// 	whitelists: [],
// }

// // NewClient creates and returns a new XRouter client.
// const NewClient = (params) => {
// 	const s = {
//     params,
//     servicenodes: {},
//     services: {},
//     mu: false,
//     addrManager: addrmgr.New(cfg.DataDir, btcdLookup)
//     s.newPeers = make(chan *serverPeer, cfg.MaxPeers)
//     s.donePeers = make(chan *serverPeer, cfg.MaxPeers)
//     s.banPeers = make(chan *serverPeer, cfg.MaxPeers)
//     s.broadcast = make(chan broadcastMsg, cfg.MaxPeers)
//     s.quit = make(chan struct{})
//     s.ready = make(chan bool)
//     s.query = make(chan interface{})
//     s.interrupt = interruptListener()
//     }
	
// 	newAddressFunc := func() (net.Addr, error) {
// 		for tries := 0; tries < 100; tries++ {
// 			addr := s.addrManager.GetAddress()
// 			if addr == nil {
// 				break
// 			}

// 			// Address will not be invalid, local or unroutable
// 			// because addrmanager rejects those on addition.
// 			// Just check that we don't already have an address
// 			// in the same group so that we are not connecting
// 			// to the same network segment at the expense of
// 			// others.
// 			key := addrmgr.GroupKey(addr.NetAddress())
// 			if s.OutboundGroupCount(key) != 0 {
// 				continue
// 			}

// 			// Mark an attempt for the valid address.
// 			s.addrManager.Attempt(addr.NetAddress())
// 			addrString := addrmgr.NetAddressKey(addr.NetAddress())
// 			if s.connManager.HasConnection(addrString) {
// 				continue
// 			}

// 			netAddr, err := addrStringToNetAddr(addrString)
// 			if err != nil {
// 				continue
// 			}

// 			return netAddr, nil
// 		}

// 		return nil, errors.New("no valid connect address")
// 	}
// 	cmgr, err := connmgr.New(&connmgr.Config{
// 		Listeners:      nil,
// 		OnAccept:       nil,
// 		RetryDuration:  connectionRetryInterval,
// 		TargetOutbound: uint32(defaultTargetOutbound),
// 		Dial:           btcdDial,
// 		OnConnection:   s.outboundPeerConnected,
// 		GetNewAddress:  newAddressFunc,
// 	})
// 	if err != nil {
// 		return nil, err
// 	}
// 	s.connManager = cmgr

// 	return &s, nil
// }