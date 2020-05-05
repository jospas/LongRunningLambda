/**
 * Lambda function called by Connect that
 * queues a job lodgement request on SQS and updates
 * a DynamoDB table to note the job has been submitted.
 */

var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB();
var sqs = new AWS.SQS();

exports.handler = async function(event, context) 
{
  console.log('[INFO] received request: %s', JSON.stringify(event, null, "  "));

  try
  {
    return await processRequest(event);
  }
  catch (error)
  {
    console.log('[ERROR] failed to process contact record', error);
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


/**
 * Processes a contact record, trying first to record a pending status
 * in DyanmoDB then submits a message to SQS for processing by the next Lambda
 */
async function processRequest(contactRecord)
{
  validateContactRecord(contactRecord);

  var contactId = contactRecord.Details.ContactData.ContactId;

  console.log('[INFO] queuing job submission for contact id: ' + contactId);

  var response = await recordQueued(contactId, contactRecord);
  await queueSQS(contactId, contactRecord);
  return response;
}

/**
 * Queues a message on SQS
 */
async function queueSQS(contactId, contactRecord)
{
  var params = {
    MessageBody: JSON.stringify(contactRecord),
    QueueUrl: process.env.SQS_QUEUE
  };
  await sqs.sendMessage(params).promise();
}

/**
 * Notify of queued status via DynamoDB
 */
async function recordQueued(contactId, contactRecord)
{
  try
  {
    var sevenDays = 60 * 60 * 24 * 7;

    var params = {
        TableName: process.env.DYNAMO_TABLE,
        Item: 
        {
            'ContactId' : {'S': contactId},
            'Status' : {'S': 'QUEUED' },
            'ExpiryTime':  {'N': "" + Math.floor(new Date() / 1000 + sevenDays) }
        }
    };

    await dynamoDB.putItem(params).promise();

    return {
      'ContactId' : contactId,
      'Status' : 'QUEUED'
    };
  }
  catch (error)
  {
    console.log('[ERROR] failed to record queued success for contact id: ' + 
      contactId, error);
    throw error;
  }
}
