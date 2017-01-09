//-----------------------------------------------------------------------------
// Name:       dhClient Service                                   
//                                                                              
// Purpose:    Microservice                                                     
//                                                                              
// Interfaces: MongoDB database                                                 
//                                                                              
// Author:     Sal Carceller                                                    
//                                                                              
//-----------------------------------------------------------------------------
var http         = require('http');
var url          = require('url');
var express      = require('express');
var bodyParser   = require('body-parser');
var request      = require('request');
var mongoClient  = require('mongodb').MongoClient;
var helper       = require('./dhCommon/helpers'); // include helper functions from helpers.js

//-----------------------------------------------------------------------------
// Set up express                                    
var app = express();
var server = http.createServer(app);
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json()); // for parsing application/json
//-----------------------------------------------------------------------------

// what host and port should we listen on?
//var _host = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';  // host to listen on
var _port = process.env.OPENSHIFT_NODEJS_PORT || 8080;       // port to listen on

//-----------------------------------------------------------------------------
// return code definitions, used in json responses {"RC": _rcOK}  
var _rcOK      = 0;
var _rcWarning = 1;
var _rcError   = 2;
var _rcUnknown = 99;
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Main code body
//-----------------------------------------------------------------------------
console.log("DreamHome.dhClient service ==> Begin Execution.");

// wait for DB module to fully initialize and connect to the backend DB
// we don't want to start the node.js server listening till we know we are fully connected to the DB
helper.dbInit( function(err)
{
  if(!err)
  { // DB connections have been established. 
    console.log('  ... application has successfully connected to the DB');
  }
  else
  { // OH no! something has gone wrong building DB connections!
    // we still proceed and start the server listening
    // but we mark the server as having a severe DB connection error!
    console.log('  ... WARNING: application failed to connect with the backend DB!');
  }

  // Start the node.js server listening
  // even if the backend DB connection fails we still want to service requests
  app.listen(_port);

  console.log('  ... application now listening on port ' + _port);
});


//-----------------------------------------------------------------------------
// fetch/get a client/customer record by clientId (cid)
//-----------------------------------------------------------------------------
app.get('/client/:cid', function(req, res) 
{
  var retjson = {"RC":_rcOK};       // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)
  var cid = req.params.cid;

  retjson.msg = "cid=" + cid;

  // send the http response message
  helper.httpJsonResponse(res,statusCode,retjson);

  return;
});


//-----------------------------------------------------------------------------
// Checks if we are connected to the DB and reports list of all collections           
//-----------------------------------------------------------------------------
app.get('/dbConnected', function(req, res)
{
  var retjson = {"RC":_rcOK};       // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)

  // test if connected to the DB
  if(helper.dbConnected()==true)
  { // connected to the DB
    retjson.success = "Succesfully connected to the DB.";
  
    // Let's fetch the list of collections currently stored in the DB
    helper.dbref().listCollections().toArray(function(err, items) 
    {
      // get the dbURL
      retjson.url = helper.dburl();

      // add the list of collections found to the return JSON
      retjson.collections = items;
  
      // send the http response message
      helper.httpJsonResponse(res,statusCode,retjson);
    });
  }
  else
  { // not connected to the DB
    retjson.RC = _rcError;
    retjson.error = "ERROR: we are not connected to the DB!";
    statusCode = 500;  // internal error while connecting to the DB
  
    // send the http response message
    helper.httpJsonResponse(res,statusCode,retjson);
  }

  return;
});

//-----------------------------------------------------------------------------
// creates the database
//-----------------------------------------------------------------------------
app.get('/dbCreate', function (req, res) 
{
  var retjson = {"RC":_rcOK};       // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)

  // test if connected to the DB
  if(helper.dbConnected()==true)
  { // connected to the DB

    // Create Counter Collection and be sure it's built prior to building any other collections.
    _createCounterColl(
    function(err)
    { // callback, called when Counter collection is fully built and initialized.
      if(!err)
      { // Counter collection is now fully built
        // we can safely proceed to build the other collections
        console.log('  ... Counter collection created successfully.' );

        // Now we will create the remaining collections, but WITHOUT any callbacks
        // we will assume everything builds correctly and check on the status later.

        // Create Client Collection
        _createClientColl();

        // Create Agent Collection
        _createAgentColl();

        // Create Office Collection
        _createNotificationColl();

        // Create Office Collection
        _createOfficeColl();

        // Create Property Collection
        _createPropertyColl();
      }
    });

    retjson.success  = "DB create processed successfull but NOT verified!";

    // send the http response message
    helper.httpJsonResponse(res,statusCode,retjson);
  }
  else
  { // not connected to the DB
    retjson = {};
    retjson.RC = _rcError;
    retjson.error = "ERROR: we are not connected to the DB!";
    statusCode = 500;  // internal error while connecting to the DB

    // send the http response message
    helper.httpJsonResponse(res,statusCode,retjson);
  }

  return;
});

//-----------------------------------------------------------------------------
// delete the database
//-----------------------------------------------------------------------------
app.get('/dbDelete', function (req, res) 
{
  var retjson = {"RC":_rcOK};       // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)

  // test if connected to the DB
  if(helper.dbConnected()==true)
  { // connected to the DB
    // delete the database
    _deleteDB();

    retjson.success  = "DB deleted successfully!";
  }
  else
  { // not connected to the DB
    retjson = {};
    retjson.RC = _rcError;
    retjson.error = "ERROR: we are not connected to the DB!";
    statusCode = 500;  // internal error while connecting to the DB
  }

  // send the http response message
  helper.httpJsonResponse(res,statusCode,retjson);

  return;
});

//-----------------------------------------------------------------------------
// functions to get/fetch records from the collections
//-----------------------------------------------------------------------------
app.get('/clients', function (req, res) 
{
//  console.log("app.get(./clients function has been called.");

  var cref = helper.crefClient();
  var dbQuery = {};               // query used for looking up records in the collection

  // fetch records from the collection based on the query desired.
  cref.find(dbQuery).toArray( function(err, items) 
  {
     if(!err)
     {
        // send the http response message
        var retjson = {"RC":_rcOK};      // assume a good json response
        var statusCode = 200;            // assume valid http response code=200 (OK, good response)

        retjson.items = items;

        // send the http response message
        helper.httpJsonResponse(res,statusCode,retjson);
     }
  });

  return;
});

app.get('/agents', function (req, res) 
{
//  console.log("app.get(./agents function has been called.");

  var cref = helper.crefAgent();
  var dbQuery = {};               // query used for looking up records in the collection

  // fetch records from the collection based on the query desired.
  cref.find(dbQuery).toArray( function(err, items) 
  {
     if(!err)
     {
        // send the http response message
        var retjson = {"RC":_rcOK};      // assume a good json response
        var statusCode = 200;            // assume valid http response code=200 (OK, good response)

        retjson.items = items;

        // send the http response message
        helper.httpJsonResponse(res,statusCode,retjson);
     }
  });

  return;
});

// functions to get/fetch records from the collections
app.get('/offices', function (req, res) 
{
//  console.log("app.get(./offices function has been called.");

  var cref = helper.crefOffice();
  var dbQuery = {};               // query used for looking up records in the collection

  // fetch records from the collection based on the query desired.
  cref.find(dbQuery).toArray( function(err, items) 
  {
     if(!err)
     {
        // send the http response message
        var retjson = {"RC":_rcOK};      // assume a good json response
        var statusCode = 200;            // assume valid http response code=200 (OK, good response)

        retjson.items = items;

        // send the http response message
        helper.httpJsonResponse(res,statusCode,retjson);
     }
  });

  return;
});

app.get('/properties', function (req, res) 
{
//  console.log("app.get(./properties function has been called.");

  var cref = helper.crefProperty();
  var dbQuery = {};               // query used for looking up records in the collection

  // fetch records from the collection based on the query desired.
  cref.find(dbQuery).toArray( function(err, items) 
  {
     if(!err)
     {
        // send the http response message
        var retjson = {"RC":_rcOK};      // assume a good json response
        var statusCode = 200;            // assume valid http response code=200 (OK, good response)

        retjson.items = items;

        // send the http response message
        helper.httpJsonResponse(res,statusCode,retjson);
     }
  });

  return;
});

app.get('/notifications', function (req, res) 
{
//  console.log("app.get(./notifications function has been called.");

  var cref = helper.crefNotification();
  var dbQuery = {};               // query used for looking up records in the collection

  // fetch records from the collection based on the query desired.
  cref.find(dbQuery).toArray( function(err, items) 
  {
     if(!err)
     {
        // send the http response message
        var retjson = {"RC":_rcOK};      // assume a good json response
        var statusCode = 200;            // assume valid http response code=200 (OK, good response)

        retjson.items = items;

        // send the http response message
        helper.httpJsonResponse(res,statusCode,retjson);
     }
  });

  return;
});

//-----------------------------------------------------------------------------
// Simple echo get method, used to sanity test service
//-----------------------------------------------------------------------------
app.get('/echo', function (req, res) 
{
//  console.log("app.get(./echo function has been called.");

  var retjson = {"RC":_rcOK};      // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)

  // send the http response message
  retjson.success = "Echo from DreamHome.dhClient service!";
  res.status(statusCode).json(retjson);
  res.end;

  return;
});


//-----------------------------------------------------------------------------
// Private function start here
//-----------------------------------------------------------------------------

// create the Counter collection that's used for uniqueIDs 
function _createCounterColl(callback) 
{
  helper.createCounterColl(callback);

  return;
}

function _createClientColl()
{
   // get refrence handle to the Client collection
   var cref = helper.crefClient();

   // create and add the first client record to the Client collection.
   // generate a unique Client Id key for this real-estate client record
   helper.genClientId(
   function(err, pkId)
   {
     if(!err)
     { // pkId generated 
       var jsonRecord = 
         {clientId:pkId,
          clientName:{clientFN:'Richard',clientLN:'Hendrix'},
          clientInfo:{address:'101 Valley Steet',city:'Glendale',state:'California',zip:'91201',phone:'555-676-8907',email:'jh@music.com'},
          agentId:1000,
          suggestedProperties:[{propertyId:2000,propertyState:0,askingPrice:320000.00,rating:0,comments:[{comment:'This is a beautiful home'}]}],
          minAskingPrice:200000.00,
          maxAskingPrice:400000.00
         };

       cref.insertOne( jsonRecord, {w:1, j:true},
       function(err,result)
       { 
         if(!err)
         {
           console.log("Client record "+pkId+" added to Client collection.");
         }
       });
     }
   });

  return;
}

function _createAgentColl()
{
   // get refrence handle to the Agent collection
   var cref = helper.crefAgent();

   // create and add the first agent record to the Agent collection.
   // generate a unique Agent Id key for this real-estate agent record
   helper.genAgentId(
   function(err, pkId)
   {
     if(!err)
     { // pkId generated 
       var jsonRecord = 
         {agentId:pkId,
          agentData:{agentFN:'Dinesh',agentLN:'Chugtai',agentLicense:'CAL-34917'},
          officeId:3000,
          properties:[{propertyId:'2000',clientId:'4000',propertyState:0}]
         };

       cref.insertOne( jsonRecord, {w:1, j:true},
       function(err,result)
       { 
         if(!err)
         {
           console.log("Agent record "+pkId+" added to Agent collection.");
         }
       });
     }
   });

  return;
}

function _createNotificationColl() 
{
  // get refrence handle to the Notification collection
  var cref = helper.crefNotification();

  // create and add the first notify record to the Notification collection.
  // generate a unique Notification Id key for this real-estate notification record
  helper.genNotificationId(
  function(err, pkId)
  {
    if(!err)
    { // pkId generated 
      var jsonRecord = 
        {notificationId:pkId,agentId:1000,clientId:4000};

      cref.insertOne( jsonRecord, {w:1, j:true},
      function(err,result)
      { 
        if(!err)
        {
          console.log("Notification record "+pkId+" added to Notification collection.");
        }
      });
    }
  });

  return;
}

function _createOfficeColl() 
{
  // get refrence handle to the Office collection
  var cref = helper.crefOffice();

  // create and add the first office record to the Office collection.
  // generate a unique Office Id key for this real-estate Office record
  helper.genOfficeId(
  function(err, pkId)
  {
    if(!err)
    { // pkId generated 
      var jsonRecord = 
        {officeId:pkId,officeName:'Valley North',officeManager:'Erlich Bachman',
         officeAddr:{address:'223 Mountain Drive',city:'Buena Vista',state:'California',zip:'91220'},
         numProperties:0
        };

      cref.insertOne( jsonRecord, {w:1, j:true},
      function(err,result)
      { 
        if(!err)
        {
          console.log("Office record "+pkId+" added to Office collection.");
        }
      });
    }
  });

  return;
}

// create the Property collection and add a few property records to the collection.
function _createPropertyColl() 
{
  // get refrence handle to the Property collection
  var cref = helper.crefProperty();

  // create and add the first property record to the Property collection.
  // generate a unique Property Id key for this real-estate property record
  helper.genPropertyId(
  function(err, pkId)
  {
    if(!err)
    { // pkId generated 
      var jsonRecord = 
        {propertyId:pkId,
         location:{address:'1024 College',city:'Wheaton',state:'California',zip:'91330',longitude:'35.601623',latitude:'-78.245908'},
         sqFeet:2895,numBeds:4,numBaths:3,yearBuilt:'1970',description:'Two blocks from university',askingPrice:233000.00
        };

      cref.insertOne( jsonRecord, {w:1, j:true},
      function(err,result)
      { 
        if(!err)
        {
          console.log("Property record "+pkId+" added to Property collection.");
        }
      });
    }
  });

  // create and another property record to the Property collection.
  // generate a unique Property Id key for this real-estate property record
  helper.genPropertyId(
  function(err, pkId)
  {
    if(!err)
    { // pkId generated 
      var jsonRecord = 
        {propertyId:pkId,
         location:{address:'435 Main',city:'Springfield',state:'California',zip:'91440',longitude:'36.507623',latitude:'-79.145509'},
         sqFeet:3200,numBeds:5,numBaths:3,yearBuilt:'1982',description:'Nice cottage by lake',askingPrice:345000.00
        };

      cref.insertOne( jsonRecord, {w:1, j:true},
      function(err,result)
      { 
        if(!err)
        {
          console.log("Property record "+pkId+" added to Property collection.");
        }
      });
    }
  });

  // create and another property record to the Property collection.
  // generate a unique Property Id key for this real-estate property record
  helper.genPropertyId(
  function(err, pkId)
  {
    if(!err)
    { // pkId generated 
      var jsonRecord = 
        {propertyId:pkId,
         location:{address:'2240',street:'Berlin',city:'Florence',state:'California',zip:'92340',longitude:'31.086579',latitude:'-72.357987'},
         sqFeet:3950,numBeds:5,numBaths:5,yearBuilt:'1967',description:'Mansion in the city',askingPrice:312000.00
        };

      cref.insertOne( jsonRecord, {w:1, j:true},
      function(err,result)
      { 
        if(!err)
        {
          console.log("Property record "+pkId+" added to Property collection.");
        }
      });
    }
  });

  return;
}

// deletes the database completely, does a drop DB
function _deleteDB() 
{
  // drop the entire database
  helper.dbref().dropDatabase();

  return;
}
