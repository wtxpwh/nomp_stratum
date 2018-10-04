var util = require('./util.js');

/*
This function creates the generation transaction that accepts the reward for
successfully mining a new block.
For some (probably outdated and incorrect) documentation about whats kinda going on here,
see: https://en.bitcoin.it/wiki/Protocol_specification#tx
 */

var generateOutputTransactions = function (poolRecipient, recipients, rpcData, poolOptions) {

    

    let txOutputBuffers = [];


    if(rpcData.znode){
    
        var rewardToPool = rpcData.coinbasevalue;
         var rewardToZcoinFounder = 100000000;
         var recipientReward = Math.floor(rewardToZcoinFounder);
          for (var i = 0; i < 4; i++){
                 txOutputBuffers.push(Buffer.concat([
                 util.packInt64LE(recipientReward),
                 util.varIntBuffer(recipients[i].script.length),
                 recipients[i].script
             ]));
             }
         rewardToZcoinFounder = 300000000;
         recipientReward = Math.floor(rewardToZcoinFounder);
         txOutputBuffers.push(Buffer.concat([
                 util.packInt64LE(recipientReward),
                 util.varIntBuffer(recipients[4].script.length),
                 recipients[4].script
                 ]));
         var znodepayeeamount = rpcData.znode.amount;
         var znodepayee = Math.floor(znodepayeeamount);
         var payeeScript = util.addressToScript(rpcData.znode.payee);
         txOutputBuffers.push(Buffer.concat([
                 util.packInt64LE(znodepayee),
                 util.varIntBuffer(payeeScript.length),
                 payeeScript
                 ]));
                }
         else if(rpcData.founderreward)
        {
            var rewardToPool = rpcData.coinbasevalue - rpcData.masternode.amount - rpcData.founderreward.amount ; 
            var rewardToDev = rpcData.founderreward.amount;
            var recipientReward = Math.floor(rewardToDev);
            var recipient = rpcData.founderreward.founderpayee;
            var recipientScript = util.addressToScript(recipient);
                    txOutputBuffers.push(Buffer.concat([
                    util.packInt64LE(recipientReward),
                    util.varIntBuffer(recipientScript.length),
                    recipientScript
                ]));
                
            var gtmmasternodepayamount = rpcData.masternode.amount;
            
            var gtmmasternodepayamountmath = Math.floor(rpcData.masternode.amount);
            var gtmmasternodepayeeScript = util.addressToScript(rpcData.masternode.payee);
            txOutputBuffers.push(Buffer.concat([
                    util.packInt64LE(gtmmasternodepayamountmath),
                    util.varIntBuffer(gtmmasternodepayeeScript.length),
                    gtmmasternodepayeeScript
                    ]));
    
        } 
        
        else if(rpcData.dynode)
        {
        var rewardToPool = rpcData.coinbasevalue - rpcData.dynode.amount;
        var masternodepayee = rpcData.dynode.payee;//
        var masternodepayamount = Math.floor(rpcData.dynode.amount);
        var payeeScript = util.addressToScript(masternodepayee);
        txOutputBuffers.push(Buffer.concat([
                util.packInt64LE(masternodepayamount),
                util.varIntBuffer(payeeScript.length),
                payeeScript
                ]));
        }
    
    
        else{
        var rewardToPool = rpcData.coinbasevalue - rpcData.masternode.amount;
        var masternodepayee = Math.floor(rpcData.masternode.amount);
        var payeeScript = util.addressToScript(rpcData.masternode.payee);
        txOutputBuffers.push(Buffer.concat([
                util.packInt64LE(masternodepayee),
                util.varIntBuffer(payeeScript.length),
                payeeScript
                ]));
        }
    
    
        txOutputBuffers.unshift(Buffer.concat([
            util.packInt64LE(rewardToPool),
            util.varIntBuffer(poolRecipient.length),
            poolRecipient
        ]));
        
    

    if (rpcData.default_witness_commitment !== undefined) {
        witness_commitment = Buffer.from(rpcData.default_witness_commitment, 'hex');
        txOutputBuffers.unshift(Buffer.concat([
            util.packInt64LE(0),
            util.varIntBuffer(witness_commitment.length),
            witness_commitment
        ]));
    }

    return Buffer.concat([
        util.varIntBuffer(txOutputBuffers.length),
        Buffer.concat(txOutputBuffers)
    ]);

};


exports.CreateGeneration = function (rpcData, publicKey, extraNoncePlaceholder, reward, txMessages, recipients, poolOptions) {
    var txInputsCount = 1;

    var txOutputsCount = 1;
    var txVersion = txMessages === true ? 2 : 1;
    var txLockTime = 0;

    var txInPrevOutHash = 0;
    var txInPrevOutIndex = Math.pow(2, 32) - 1;
    var txInSequence = 0;

    //Only required for POS coins
    var txTimestamp = reward === 'POS' ?
        util.packUInt32LE(rpcData.curtime) : Buffer.from([]);

    //For coins that support/require transaction comments
    var txComment = txMessages === true ?
        util.serializeString('https://github.com/foxer666/node-open-mining-portal') :
        Buffer.from([]);


    var scriptSigPart1 = Buffer.concat([
        util.serializeNumber(rpcData.height),
        Buffer.from(rpcData.coinbaseaux.flags, 'hex'),
        util.serializeNumber(Date.now() / 1000 | 0),
        Buffer.from([extraNoncePlaceholder.length])
    ]);

    var scriptSigPart2 = util.serializeString('/nodeStratum/');

    var p1 = Buffer.concat([
        util.packUInt32LE(txVersion),
        txTimestamp,

        //transaction input
        util.varIntBuffer(txInputsCount),
        util.uint256BufferFromHash(txInPrevOutHash),
        util.packUInt32LE(txInPrevOutIndex),
        util.varIntBuffer(scriptSigPart1.length + extraNoncePlaceholder.length + scriptSigPart2.length),
        scriptSigPart1
    ]);


    /*
    The generation transaction must be split at the extranonce (which located in the transaction input
    scriptSig). Miners send us unique extranonces that we use to join the two parts in attempt to create
    a valid share and/or block.
     */


    var outputTransactions = generateOutputTransactions(publicKey, recipients, rpcData, poolOptions);

    var p2 = Buffer.concat([
        scriptSigPart2,
        util.packUInt32LE(txInSequence),
        //end transaction input

        //transaction output
        outputTransactions,
        //end transaction ouput

        util.packUInt32LE(txLockTime),
        txComment
    ]);

    return [p1, p2];

};
