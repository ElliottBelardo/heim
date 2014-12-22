var support = require('./support/setup')
var assert = require('assert')
var sinon = require('sinon')
var Immutable = require('immutable')

describe('notification store', function() {
  var notification = require('../lib/stores/notification')
  var storage = require('../lib/stores/storage')
  var _Notification = window.Notification

  beforeEach(function() {
    sinon.stub(storage, 'set')
  })

  afterEach(function() {
    window.Notification = _Notification
    storage.set.restore()
  })

  describe('when unsupported', function() {
    beforeEach(function() {
      delete window.Notification
      support.resetStore(notification.store)
    })

    it('should set unsupported', function() {
      assert.equal(notification.store.getInitialState().supported, false)
    })
  })

  describe('when supported but not permitted', function() {
    beforeEach(function() {
      window.Notification = {permission: 'default'}
      support.resetStore(notification.store)
    })

    it('should set supported', function() {
      assert.equal(notification.store.getInitialState().supported, true)
    })

    it('should set no permission', function() {
      assert.equal(notification.store.getInitialState().permission, false)
    })

    describe('enabling', function() {
      beforeEach(function() {
        Notification.requestPermission = sinon.spy()
      })

      it('should request permission', function() {
        notification.store.enable()
        sinon.assert.calledWithExactly(Notification.requestPermission, notification.store.onPermission)
      })
    })

    describe('receiving permission', function() {
      it('should set permission', function(done) {
        support.listenOnce(notification.store, function(state) {
          assert.equal(state.permission, true)
          done()
        })
        notification.store.onPermission('granted')
      })

      it('should store enabled', function() {
        notification.store.onPermission('granted')
        sinon.assert.calledWithExactly(storage.set, 'notify', true)
      })
    })

    describe('receiving denial', function() {
      it('should set no permission', function(done) {
        support.listenOnce(notification.store, function(state) {
          assert.equal(state.permission, false)
          done()
        })
        notification.store.onPermission('denied')
      })
    })
  })

  describe('when supported and permitted', function() {
    var mockChatState = {
      messages: Immutable.fromJS([
        {
          'time': 123456,
          'sender': {
            'id': '32.64.96.128:12345',
            'name': 'logan',
          },
          'content': 'hello, ezzie!',
        }
      ])
    }

    var mockChatState2 = {
      messages: mockChatState.messages.push(Immutable.fromJS({
        'time': 123456,
        'sender': {
          'id': '32.64.96.128:12345',
          'name': 'ezzie',
        },
        'content': 'woof!',
      }))
    }

    var mockChatStateEmpty = {
      messages: Immutable.fromJS([])
    }

    var fakeNotification

    beforeEach(function() {
      window.Notification = sinon.spy(function() {
        this.close = sinon.spy()
        fakeNotification = this
      })
      Notification.permission = 'granted'
      support.resetStore(notification.store)
    })

    it('should set supported', function() {
      assert.equal(notification.store.getInitialState().supported, true)
    })

    it('should set permission', function() {
      assert.equal(notification.store.getInitialState().permission, true)
    })

    describe('enabling', function() {
      it('should store enabled', function() {
        notification.store.enable()
        sinon.assert.calledWithExactly(storage.set, 'notify', true)
      })
    })

    describe('disabling', function() {
      it('should store disabled', function() {
        notification.store.disable()
        sinon.assert.calledWithExactly(storage.set, 'notify', false)
      })
    })

    describe('focus tracking', function() {
      it('should start focused', function() {
        assert.equal(notification.store.focus, true)
      })

      it('should set focused when window focused', function() {
        notification.store.onFocus()
        assert.equal(notification.store.focus, true)
      })

      it('should set unfocused when window blurred', function() {
        notification.store.onBlur()
        assert.equal(notification.store.focus, false)
      })

      it('should not open notifications when focused', function() {
        notification.store.onFocus()
        notification.store.storageChange({notify: true})
        notification.store.chatUpdate(mockChatState)
        sinon.assert.notCalled(Notification)
      })

      it('should close notification when window focused', function() {
        notification.store.onBlur()
        notification.store.storageChange({notify: true})
        notification.store.chatUpdate(mockChatState)
        sinon.assert.calledOnce(Notification)
        notification.store.onFocus()
        sinon.assert.calledOnce(fakeNotification.close)
      })
    })

    describe('with a notification showing', function() {
      beforeEach(function() {
        notification.store.onBlur()
        notification.store.storageChange({notify: true})
        notification.store.chatUpdate(mockChatState)
        sinon.stub(window, 'focus')
      })

      afterEach(function() {
        window.focus.restore()
      })

      it('should not open another notification', function() {
        notification.store.chatUpdate(mockChatState2)
        sinon.assert.calledOnce(Notification)
      })

      it('should ignore extraneous chat events', function() {
        notification.store.chatUpdate(mockChatStateEmpty)
        sinon.assert.calledOnce(Notification)
      })

      it('should focus window when clicked', function() {
        fakeNotification.onclick()
        sinon.assert.calledOnce(window.focus)
      })
    })
  })
})
