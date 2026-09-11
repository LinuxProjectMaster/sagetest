const awsmobile = {
    Auth: {
        Cognito: {
            userPoolId: 'us-east-1_o2d7FPiLR',
            userPoolClientId: '4t9lbhdpth4phfi908rapgvbkb',
            identityPoolId: "us-east-1:f9b0a105-4efc-4052-ae45-ab1c15c9982a",
            loginWith: {
                oauth: {
                    domain: 'growmyownfood.auth.us-east-1.amazoncognito.com',
                    scopes: ['email', 'openid', 'profile', 'aws.cognito.signin.user.admin'],
                    redirectSignIn: ['sagetest://'],
                    redirectSignOut: ['sagetest://'],
                    responseType: 'code',
                },
            },
        }
    },
    Storage: {
       S3: {
           bucket: 'sagestoragetime145131-dev',
           region: 'us-east-1',
           
       },
   }
};


export default awsmobile;