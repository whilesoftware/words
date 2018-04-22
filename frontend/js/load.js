var words = angular.module('words');

words.controller(
	'loadController', 
	[
		'$scope',
    '$timeout',
		function ($scope, $timeout) {
      $scope.count = 0;
      $scope.loadingtext = "";
      $scope.showntext = "";
      $scope.isloading = true;

      $scope.timeout_promise = null;

      function show_text() {
        //console.log('showing text');
        $scope.showntext = $scope.loadingtext;
      }

      $scope.bump_show_text = function(newtext) {
        //console.log('new text: ' + newtext);
        $scope.loadingtext = newtext;
        if ($scope.showntext != "") {
          show_text();
        }else{
          if ($scope.timeout_promise != null) {
            $timeout.cancel($scope.timeout_promise);
          }
          //console.log('setting timeout');
          $scope.timeout_promise = $timeout(show_text, 2000);
        }
      };

      $scope.bump_show_text('loading');

      $scope.$on('gameloaded', function() {
        $scope.isloading = false;
      });
		}
	]
);

