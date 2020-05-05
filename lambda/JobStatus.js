/**
 * Lambda function that checks the status of
 * a submitted job by querying DynamoDB
 */

var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION}); 
var dynamoDB = new AWS.DynamoDB();

exports.handler = async function(event, context) 
{
  console.log('[INFO] received request: %s', JSON.stringify(event, null, "  "));

  try
  {
    return await processRecord(event);
  }
  catch (error)
  {
    console.log('[ERROR] failed to check status for contact record', error);
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
 * Processes a contact record looking for a record in 
 * DynamoDB for this contact id.
 * If no record exists return an UNKOWN status.
 * Other valid status values include QUEUED, SUCCESS and FAILURE
 */
async function processRecord(contactRecord)
{
  validateContactRecord(contactRecord);

  var contactId = contactRecord.Details.ContactData.ContactId;

  console.log('[INFO] checking job submission for contact id: ' + contactId);

  var params = {
      TableName: process.env.DYNAMO_TABLE,
      Key: 
      {
          'ContactId' : {'S': contactId}
      }
  };

  var dynamoResponse = await dynamoDB.getItem(params).promise();

  if (dynamoResponse.Item)
  {
    let response =
    {
      contactId: dynamoResponse.Item.ContactId.S,
      status: dynamoResponse.Item.Status.S
    };

    if (dynamoResponse.Item.JobId)
    {
      response.jobId = dynamoResponse.Item.JobId.S;
    }

    if (dynamoResponse.Item.Cause)
    {
      response.cause = dynamoResponse.Item.Cause.S;
    }

    console.log('[INFO] made response: ' + JSON.stringify(response, null, "  "));

    return response;
  }
  else
  {
    let response =
    {
      contactId: contactId,
      status: 'UNKNOWN'
    };

    console.log('[INFO] made response: ' + JSON.stringify(response, null, "  "));

    return response;
  }
}