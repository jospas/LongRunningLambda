/**
 * Lambda function that listens to SQS and actually lodges jobs
 * updates DynamoDB to mark as successful of failed.
 * Only one SQS message is expected and it should contact a 
 */

var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB();

exports.handler = async function(event, context) 
{
  console.log('[INFO] received request: %s', JSON.stringify(event, null, "  "));

  try
  {
    if (event.Records && event.Records.length == 1)
    {
      return await submitJob(JSON.parse(event.Records[0].body));
    }
    else
    {
      throw new Error('Invalid request, expected exactly one contact record');
    }

  }
  catch (error)
  {
    console.log('[ERROR] failed to process messages', error);
    throw error;
  }
  
};

function validateContactRecord(contactRecord)
{
  if (!contactRecord.Details || 
      !contactRecord.Details.ContactData || 
      !contactRecord.Details.ContactData.ContactId)
  {
    throw new Error('Invalid input contact record, could not locate ContactId');
  }
}

async function submitJob(contactRecord)
{
  validateContactRecord(contactRecord);

  var contactId = contactRecord.Details.ContactData.ContactId;

  console.log('[INFO] processing contact id: ' + contactId);

  var sleepTimeSeconds = 5 + getRandomInt(20);

  console.log('[INFO] sleeping for: ' + sleepTimeSeconds + ' seconds');

  await sleep(sleepTimeSeconds * 1000);

  /**
   * Randomly fail 20% of the time
   * and record failure
   */
  if (Math.random() > 0.8)
  {
    var error = new Error("Failure detected in lodging job");
    return await recordFailure(contactId, contactRecord, error);
  }
  /**
   * Succeed 80% of the time and record success
   */
  else
  {
    var jobResponse = {
      jobId: '' + (1000000 + getRandomInt(1000000))
    };
    return await recordSuccess(contactId, contactRecord, jobResponse);
  }
}

/**
 * Notify of success via DynamoDB
 */
async function recordSuccess(contactId, contactRecord, jobResponse)
{
  try
  {
    var sevenDays = 60 * 60 * 24 * 7;

    var params = {
        TableName: process.env.DYNAMO_TABLE,
        Item: 
        {
            'ContactId' : {'S': contactId},
            'Status' : {'S': 'SUCCESS' },
            'JobId':  {'S': jobResponse.jobId },
            'ExpiryTime':  {'N': "" + Math.floor(new Date() / 1000 + sevenDays) }
        }
    };

    await dynamoDB.putItem(params).promise();

    return {
      'ContactId' : contactId,
      'Status' : 'SUCCESS',
      'JobId':  jobResponse.jobId
    };
  }
  catch (error)
  {
    console.log('[ERROR] failed to record success for contact id: ' + 
      contactId, error);
    throw error;
  }
}

/**
 * Notify of failure via DynamoDB
 */
async function recordFailure(contactId, contactRecord, error)
{
  try
  {
    var sevenDays = 60 * 60 * 24 * 7;

    var params = {
        TableName: process.env.DYNAMO_TABLE,
        Item: 
        {
            'ContactId' : {'S': contactId},
            'Status' : {'S': 'FAILURE' },
            'Cause':  {'S': error.message },
            'ExpiryTime':  {'N': "" + Math.floor(new Date() / 1000 + sevenDays) }
        }
    };

    await dynamoDB.putItem(params).promise();

    return {
      'ContactId' : contactId,
      'Status' : 'FAILURE',
      'Cause' : error.message
    };
  }
  catch (error2)
  {
    console.log('[ERROR] failed to record failure for contact id: ' + 
      contactId, error2);
    throw error;
  }
}

/**
 * Sleeps for the requested millis
 */
function sleep(millis)
{
  return new Promise(resolve => {
      setTimeout(resolve, millis);
  });
}

/**
 * Fetches a bounded random int
 */
function getRandomInt(max) 
{
  return Math.floor(Math.random() * Math.floor(max));
}