define([
    '../assets/fh-ui/js/fh-ui.min',
    '../assets/fh-ui/js/plugins/laydate/laydate.min',
    '../assets/fh-ui/js/lib/template/template.min',
    '../assets/eCharts/echarts'
], (fhUi, laydate, template, eCharts) => {
    return {
        init() {
            // indexedDB instance
            window.db = null
            // eCharts instance
            window.eChartsInstance = eCharts.init($('#eCharts-wrapper')[0])
            // register tip func
            window._tip = (msg, intent, timeout) => {
                Dialog.toast(msg, {
                    intent: intent || `primary`,
                    timeout: timeout || 3000
                })
            }
            this._openDB(() => {
                this._get('all', (data) => {
                    this._renderNumber(data)
                    this._renderCharts(data, 'all')
                })
            })
            this._initLayDate()
            this._event()
        },
        // open database
        _openDB(cb) {
            const _self = this
            // open or create
            const request = indexedDB.open('DB_number')
            // if not exist this database, create database and table at the first time
            request.onupgradeneeded = (e) => {
                _tip('数据库创建成功！', 'success')
                db = e.target.result;
                !db.objectStoreNames.contains('table_number') ?
                    db.createObjectStore('table_number', {
                        keyPath: 'result_date'
                    }) : null

            }
            request.onsuccess = (e) => {
                _tip('数据库连接成功！', 'success')
                db = e.target.result
                cb && cb()
            }
            request.onerror = (e) => _tip('数据库连接失败！', 'danger')
        },
        // init layDate plugin
        _initLayDate() {
            let year = new Date().getFullYear()
            let month = new Date().getMonth() + 1 < 10 ? `0${new Date().getMonth() + 1}` : new Date().getMonth() + 1
            let today = new Date().getDate() < 10 ? `0${new Date().getDate()}` : new Date().getDate()
            laydate.render({
                elem: 'input#date-input',
                value: `${year}-${month}-${today}`,
                showBottom: true
            })
        },
        // set total date counts
        _setDateCounts(counts) {
            $('.date-counts-wrapper span.date-counts').text(counts)
        },
        // add number to database
        _add(date, number) {
            const _self = this
            const request = db.transaction(['table_number'], 'readwrite')
                .objectStore('table_number')
                .add({
                    result_date: date,
                    number: number
                })
            request.onsuccess = (e) => {
                _tip('添加成功！', 'success')
                _self._get('all', (data) => {
                    _self._renderNumber(data)
                    $('.eCharts-option-button span.btn-state[data-value="all"]').addClass('checked').siblings().removeClass('checked')
                    _self._renderCharts(data, 'all')
                })
            }
            request.onerror = (e) => _tip('已存在本期！', 'danger')
        },
        // read number from database
        _get(date, cb) {
            const _self = this
            const request = date === 'all' ?
                db.transaction(['table_number']).objectStore('table_number').getAll() : db.transaction(['table_number']).objectStore('table_number').get(date)
            request.onsuccess = (e) => {
                if (request.result) {
                    cb && cb.call(_self, request.result)
                } else {
                    request.onerror = (e) => _tip(date === 'all' ? '数据库没有任何记录!' : '未找到该期记录!', 'danger')
                }
            }
            request.onerror = (e) => _tip('事务失败!', 'danger')
        },
        // delete form database
        _delete(resultDate) {
            const _self = this
            const request = db.transaction(['table_number'], 'readwrite').objectStore('table_number').delete(resultDate)
            request.onsuccess = (e) => {
                _tip('删除成功！', 'success')
                _self._get('all', (data) => {
                    _self._renderNumber(data)
                    $('.eCharts-option-button span.btn-state[data-value="all"]').addClass('checked').siblings().removeClass('checked')
                    _self._renderCharts(data, 'all')
                })
            }
            request.onerror = (e) => _tip('删除失败！', 'danger')
        },
        // update to database
        _update(resultDate, number) {
            const _self = this
            const request = db.transaction(['table_number'], 'readwrite').objectStore('table_number').put({
                result_date: resultDate,
                number: number
            })
            request.onsuccess = (e) => {
                _tip('保存成功！', 'success')
                _self._get('all', (data) => {
                    _self._renderNumber(data)
                    $('.eCharts-option-button span.btn-state[data-value="all"]').addClass('checked').siblings().removeClass('checked')
                    _self._renderCharts(data, 'all')
                })
            }
            request.onerror = (e) => _tip('保存失败！', 'danger')
        },
        // render all number
        _renderNumber(data, targetNum) {
            const _self = this
            if (!data.length) {
                $('.recent-result').empty().append(`<div class="blank-nodata-icon"><p class="msg">没有数据</p></div>`)
            } else {
                let allNumberTpl = `
                {{each data as e index}}
                    <div class="period-row">
                        <div class="result-date">
                            <span class="text-primary">{{e.result_date}}</span>
                        </div>
                        <div class="number-wrapper">
                            {{each e.number as subE subIndex}}
                                <div class="number-item {{targetNum === subE ? 'target-number' : ''}}">
                                    <span class="number-info">{{subE}}</span>
                                </div>
                            {{/each}}
                        </div>
                        <div class="opt-buttons">
                            <button type="button" class="btn btn-sm btn-default hidden" data-date="{{e.result_date}}" data-action="edit" title="编辑">
                                <i class="aidicon aidicon-pencil-circle"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-default hidden" data-date="{{e.result_date}}" data-action="delete" title="删除">
                                <i class="aidicon aidicon-close-circle"></i>
                            </button>
                        </div>
                    </div>
                {{/each}}`
                $('.recent-result').empty().append(template.compile(allNumberTpl)({
                    data: data.reverse(),
                    targetNum: targetNum
                }))
            }
            _self._setDateCounts(data.length)
        },
        // render eCharts
        _renderCharts(data, type) {
            // format data
            let countsArr = Array.from(new Array(80), e => e = 0)
            data.forEach(e => {
                e.number.forEach(subE => {
                    countsArr[Number(subE) - 1]++
                })
            })
            let sortedOddAndEvenArr = countsArr.map((e, index) => {
                return {
                    number: index + 1,
                    counts: e
                }
            }).sort(((key) => {
                return (a, b) => b[key] - a[key]
            })('counts'))
            // type odd
            if (type === 'odd') sortedOddAndEvenArr = sortedOddAndEvenArr.filter(e => e.number % 2 === 1)
            // type even
            if (type === 'even') sortedOddAndEvenArr = sortedOddAndEvenArr.filter(e => e.number % 2 === 0)
            // y -> number
            let yArr = sortedOddAndEvenArr.map(e => e.number).reverse()
            // number -> value
            let ValueArr = sortedOddAndEvenArr.map(e => e.counts).reverse()
            // eCharts options
            const options = {
                title: {
                    text: '开奖数字结果统计',
                    subtext: '本地数据'
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'shadow'
                    },
                    formatter(obj) {
                        return `号码 ${obj[0].axisValue} 出现了 ${obj[0].data} 次`
                    }
                },
                grid: {
                    containLabel: true
                },
                xAxis: {
                    name: '出现次数'
                },
                yAxis: {
                    name: '号码',
                    type: 'category',
                    data: yArr
                },
                series: [{
                    type: 'bar',
                    data: ValueArr,
                    itemStyle: {
                        normal: {
                            label: {
                                show: true,
                                position: 'right',
                                textStyle: {
                                    color: 'black',
                                    fontSize: 12
                                }
                            },
                            color(obj) {
                                let poorValuePercent = (Number(obj.data) - Number(ValueArr[0])) / (Number(ValueArr[ValueArr.length - 1]) - Number(ValueArr[0]))
                                if (type === 'all') return `rgb(${97 + (134 - 97) * poorValuePercent}, ${176 - (176 - 88) * poorValuePercent}, ${254 - (254 - 231) * poorValuePercent})`
                                if (type === 'odd') return `rgb(${182 - (182 - 52) * poorValuePercent}, ${204 + (248 - 204) * poorValuePercent}, ${221 + (239 - 221) * poorValuePercent})`
                                if (type === 'even') return `rgb(${51 + (111 - 51) * poorValuePercent}, ${272 - (272 - 147) * poorValuePercent}, 255)`
                            }
                        }
                    }
                }]
            }
            eChartsInstance.setOption(options)
        },
        // add number
        _addNumber() {
            const _self = this
            let date = `${$('input#date-input').val()}(${['日','一','二','三','四','五','六'][new Date($('input#date-input').val()).getDay()]})`
            let number = $('input#result-input').val().split(/\s+/g).filter(e => e).map(e => {
                return e.length === 1 ? `0${e}` : e
            })
            number.length < 20 && _tip('你输入的号码少于20位哦~')
            number.length > 20 && _tip('你输入的号码大于20位哦~')
            number.length === 20 && _self._add(date, number)
        },
        // query number counts
        _queryNumberCounts() {
            const _self = this
            let tarNumber = $('input#counts-query').val().length === 1 ? `0${$('input#counts-query').val()}` : `${$('input#counts-query').val()}`
            if (tarNumber) {
                _self._get('all', (data) => {
                    let includeTargetRowArr = data.filter(e => e.number.includes(tarNumber))
                    _tip(`号码 ${$('input#counts-query').val()} 一共出现了 ${includeTargetRowArr.length} 次~`, 'primary', 5000)
                    _self._renderNumber(includeTargetRowArr, tarNumber)
                })
            } else {
                _tip(`你还没有输入数字呢~`)
            }
        },
        // check odd or even
        _checkOddEven() {
            let number = $('input#odd-even-number').val()
            if (number.length) {
                Number(number) % 2 === 0 ? _tip(`${number}是偶数~`) : _tip(`${number}是奇数~`)
            } else {
                _tip(`你还没有输入数字呢~`)
            }
        },
        // register event
        _event() {
            const _self = this
            // number row button display
            $(document).on({
                mouseout: function () {
                    $(this).find('button').toggleClass('hidden')
                },
                mouseover: function () {
                    $(this).find('button').toggleClass('hidden')
                }
            }, '.period-row')
            // reset
            $(document).on('keydown', (e) => {
                if (e.keyCode === 27) {
                    $('input#result-input').val('')
                    $('input#counts-query').val('')
                    $('input#odd-even-number').val('')
                    _self._get('all', (data) => this._renderNumber(data))
                }
            })
            // edit
            $(document).on('click', 'button[data-action="edit"]', function () {
                let currentDate = $(this).data('date')
                Dialog.open({
                    id: 'edit-number',
                    title: `<span class="aidicon aidicon-lead-pencil aidicon-success"></span>编辑第 < <span class="text-primary">${currentDate}</span> > 期`,
                    width: 600,
                    context: window,
                    content: `<div class="form-horizon">
                                    <form class="edit-form">
                                        <div class="form-group clearfix">
                                            <input type="text" class="form-control" id="edit-number" placeholder="请输入修改后的号码" autocomplete="off" value="">
                                        </div>
                                    </form>
                                </div>`,
                    onShow() {
                        _self._get(currentDate, (data) => {
                            $('input#edit-number').val(data.number.join(' '))
                        })
                    },
                    button: [{
                        id: 'cancel',
                        label: '取消',
                        intent: 'default'
                    }, {
                        id: 'done',
                        label: '保存',
                        intent: 'primary',
                        click() {
                            let editedNumber = $('input#edit-number').val().split(/\s+/g).filter(e => e).map(e => {
                                return e.length === 1 ? `0${e}` : e
                            })
                            if (editedNumber.length < 20) {
                                _tip('你输入的号码少于20位哦~')
                                return false
                            }
                            if (editedNumber.length > 20) {
                                _tip('你输入的号码大于20位哦~')
                                return false
                            }
                            editedNumber.length === 20 && _self._update(currentDate, editedNumber)
                        }
                    }]
                })
            })
            // delete
            $(document).on('click', 'button[data-action="delete"]', function () {
                Dialog.confirm('删除后无法恢复，请谨慎操作！', () => _self._delete($(this).data('date')), () => null, {
                    title: '确定要删除本期结果吗？',
                    yesLabel: '确定',
                    yesStyle: 'danger',
                    noLabel: '取消',
                    noStyle: 'default'
                })
            })
            // add number
            $(document).on('click', 'button#add-number', (e) => {
                _self._addNumber()
            })
            $(document).on('keydown', 'input#result-input', (e) => {
                e.keyCode === 13 && _self._addNumber()
            })
            // query number counts
            $(document).on('click', 'button#counts-query-button', (e) => {
                _self._queryNumberCounts()
            })
            $(document).on('keydown', 'input#counts-query', (e) => {
                e.keyCode === 13 && _self._queryNumberCounts()
            })
            // check odd or even
            $(document).on('click', 'button#check-odd-even', (e) => {
                _self._checkOddEven()
            })
            $(document).on('keydown', 'input#odd-even-number', (e) => {
                e.keyCode === 13 && _self._checkOddEven()
            })
            // statistics module
            $(document).on('click', '.eCharts-option-button span.btn-state', function () {
                let type = $(this).data('value')
                _self._get('all', (data) => _self._renderCharts(data, type))
            })
        }
    }
})