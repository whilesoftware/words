var words = angular.module('words', ['ui.router']);

words.config([
  '$stateProvider',
  '$urlRouterProvider',
  '$urlMatcherFactoryProvider',
  '$locationProvider',
  '$httpProvider',
  function($stateProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $locationProvider, $httpProvider) {
    $urlMatcherFactoryProvider.strictMode(false);
    $stateProvider
      .state('game', {
        url: '/',
        templateUrl: 'view/game.html',
        controller: 'gameController'
      });

    $urlRouterProvider.otherwise(function($injector, $location) {
      console.log('no router specified for: ' + $location.path());
    });
    $locationProvider.html5Mode(true);
  }
]);

angular.element(document).ready(() => {
  angular.bootstrap(document, ['words']);
});  

