/**
 *@description 观察者模式 全局监听富文本编辑器
 */
export const QuillWatch = {
  watcher: {},  // 登记编辑器信息
  active: null,  // 当前触发的编辑器
  on: function (imageExtendId, ImageExtend) {  // 登记注册使用了ImageEXtend的编辑器
      if (!this.watcher[imageExtendId]) {
          this.watcher[imageExtendId] = ImageExtend
      }
  },
  emit: function (activeId, type = 1) {  // 事件发射触发
      this.active = this.watcher[activeId]
      if (type === 1) {
          imgHandler()
      }
  }
}

/**
* @description 图片功能拓展： 增加上传 拖动 复制
*/
export class ImageExtend {
  /**
   * @param quill {Quill}富文本实例
   * @param config {Object} options
   * config  keys: action, headers, editForm start end error  size response
   */
  constructor(quill, config = {}) {
      this.id = Math.random()
      this.quill = quill
      this.quill.id = this.id
      this.config = config
      this.file = ''  // 要上传的图片
      this.imgURL = ''  // 图片地址
      quill.root.addEventListener('paste', this.pasteHandle.bind(this), false)
      quill.root.addEventListener('drop', this.dropHandle.bind(this), false)
      quill.root.addEventListener('dropover', function (e) {
          e.preventDefault()
      }, false)
      this.cursorIndex = 0
      QuillWatch.on(this.id, this)
  }

  /**
   * @description 粘贴
   * @param e
   */
  pasteHandle(e) {
      // e.preventDefault()
      QuillWatch.emit(this.quill.id, 0)
      let clipboardData = e.clipboardData
      let i = 0
      let items, item, types

      if (clipboardData) {
          items = clipboardData.items;

          if (!items) {
              return;
          }
          item = items[0];
          types = clipboardData.types || [];

          for (; i < types.length; i++) {
              if (types[i] === 'Files') {
                  item = items[i];
                  break;
              }
          }
          if (item && item.kind === 'file' && item.type.match(/^image\//i)) {
              this.file = item.getAsFile()
              let self = this
              // 如果图片限制大小
              if (self.config.size && self.file.size >= self.config.size * 1024 * 1024) {
                  if (self.config.sizeError) {
                      self.config.sizeError()
                  }
                  return
              }
              if (this.config.action) {
                  // this.uploadImg()
              } else {
                  // this.toBase64()
              }
          }
      }
  }

  /**
   * 拖拽
   * @param e
   */
  dropHandle(e) {
      QuillWatch.emit(this.quill.id, 0)
      const self = this
      e.preventDefault()
      // 如果图片限制大小
      if (self.config.size && self.file.size >= self.config.size * 1024 * 1024) {
          if (self.config.sizeError) {
              self.config.sizeError()
          }
          return
      }
      self.file = e.dataTransfer.files[0]; // 获取到第一个上传的文件对象
      if (this.config.action) {
          self.uploadImg()
      } else {
          self.toBase64()
      }
  }

  /**
   * @description 将图片转为base4
   */
  toBase64() {
      const self = this
      const reader = new FileReader()
      reader.onload = (e) => {
          // 返回base64
          self.imgURL = e.target.result
          self.insertImg()
      }
      reader.readAsDataURL(self.file)
  }

  /**
   * @description 上传图片到服务器
   */
  uploadImg() {
      const self = this
      let quillLoading = self.quillLoading
      let config = self.config
      // 构造表单
      let formData = new FormData()
      formData.append(config.name, self.file)
      // 自定义修改表单
      if (config.editForm) {
          config.editForm(formData)
      }
      // 创建ajax请求
      let xhr = new XMLHttpRequest()
      xhr.open('post', config.action, true)
      // 如果有设置请求头
      if (config.headers) {
          config.headers(xhr)
      }
      if (config.change) {
          config.change(xhr, formData)
      }
      xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
              if (xhr.status === 200) {
                  //success
                  let res = JSON.parse(xhr.responseText)
                  self.imgURL = config.response(res)
                  QuillWatch.active.uploadSuccess()
                  self.insertImg()
                  if (self.config.success) {
                      self.config.success()
                  }
              } else {
                  //error
                  if (self.config.error) {
                      self.config.error()
                  }
                  QuillWatch.active.uploadError()
              }
          }
      }
      // 开始上传数据
      xhr.upload.onloadstart = function (e) {
          QuillWatch.active.uploading()
          // let length = (self.quill.getSelection() || {}).index || self.quill.getLength()
          // self.quill.insertText(length, '[uploading...]', { 'color': 'red'}, true)
          if (config.start) {
              config.start()
          }
      }
      // 上传过程
      xhr.upload.onprogress = function (e) {
          let complete = (e.loaded / e.total * 100 | 0) + '%'
          QuillWatch.active.progress(complete)
      }
      // 当发生网络异常的时候会触发，如果上传数据的过程还未结束
      xhr.upload.onerror = function (e) {
          QuillWatch.active.uploadError()
          if (config.error) {
              config.error()
          }
      }
      // 上传数据完成（成功或者失败）时会触发
      xhr.upload.onloadend = function (e) {
          if (config.end) {
              config.end()
          }
      }
      xhr.send(formData)
  }

  /**
   * @description 往富文本编辑器插入图片
   */
  insertImg() {
      const self = QuillWatch.active
      self.quill.insertEmbed(QuillWatch.active.cursorIndex, 'image', self.imgURL)
      self.quill.update()
      self.quill.setSelection(self.cursorIndex+1);
  }

  /**
   * @description 显示上传的进度
   */
  progress(pro) {
      pro = '[' + 'uploading' + pro + ']'
      QuillWatch.active.quill.root.innerHTML
          = QuillWatch.active.quill.root.innerHTML.replace(/\[uploading.*?\]/, pro)
  }

  /**
   * 开始上传
   */
  uploading() {
      let length = (QuillWatch.active.quill.getSelection() || {}).index || QuillWatch.active.quill.getLength()
      QuillWatch.active.cursorIndex = length
      QuillWatch.active.quill.insertText(QuillWatch.active.cursorIndex, '[uploading...]', {'color': 'red'}, true)
  }

  /**
   * 上传失败
   */
  uploadError() {
      QuillWatch.active.quill.root.innerHTML
          = QuillWatch.active.quill.root.innerHTML.replace(/\[uploading.*?\]/, '[upload error]')
  }

  uploadSuccess() {
      QuillWatch.active.quill.root.innerHTML
          = QuillWatch.active.quill.root.innerHTML.replace(/\[uploading.*?\]/, '')
  }
  // 压缩图片
  compress (img) {
    let canvas = document.createElement('canvas')
    let ctx = canvas.getContext('2d')
    // 瓦片canvas
    let tCanvas = document.createElement('canvas')
    let tctx = tCanvas.getContext('2d')
    let initSize = img.src.length
    let width = img.width
    let height = img.height
    // 如果图片大于四百万像素，计算压缩比并将大小压至400万以下
    let ratio
    if ((ratio = width * height / 4000000) > 1) {
      console.log('大于400万像素')
      ratio = Math.sqrt(ratio)
      width /= ratio
      height /= ratio
    } else {
      ratio = 1
    }
    canvas.width = width
    canvas.height = height
    //        铺底色
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // 如果图片像素大于100万则使用瓦片绘制
    let count
    if ((count = width * height / 1000000) > 1) {
      console.log('超过100W像素')
      count = ~~(Math.sqrt(count) + 1) // 计算要分成多少块瓦片
      //            计算每块瓦片的宽和高
      let nw = ~~(width / count)
      let nh = ~~(height / count)
      tCanvas.width = nw
      tCanvas.height = nh
      for (let i = 0; i < count; i++) {
        for (let j = 0; j < count; j++) {
          tctx.drawImage(
            img,
            i * nw * ratio,
            j * nh * ratio,
            nw * ratio,
            nh * ratio,
            0,
            0,
            nw,
            nh
          )
          ctx.drawImage(tCanvas, i * nw, j * nh, nw, nh)
        }
      }
    } else {
      ctx.drawImage(img, 0, 0, width, height)
    }
    // 进行最小压缩
    let ndata = canvas.toDataURL('image/jpeg', 0.7)
    console.log('压缩前：' + initSize)
    console.log('压缩后：' + ndata.length)
    console.log(
      '压缩率：' + ~~(100 * (initSize - ndata.length) / initSize) + '%'
    )
    tCanvas.width = tCanvas.height = canvas.width = canvas.height = 0
    return ndata
  }
  // dataURl转FIle
  dataURLtoFile (dataurl, filename) {
    let arr = dataurl.split(',')
    let mime = arr[0].match(/:(.*?);/)[1]
    let bstr = atob(arr[1])
    let n = bstr.length
    let u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new File([u8arr], filename, {
      type: mime
    })
  }
}

/**
* @description 点击图片上传
*/
export function imgHandler() {
  let fileInput = document.querySelector('.quill-image-input');
  if (fileInput === null) {
      fileInput = document.createElement('input');
      fileInput.setAttribute('type', 'file');
      fileInput.classList.add('quill-image-input');
      fileInput.style.display = 'none'
      // 监听选择文件
      fileInput.addEventListener('change', function () {
          let self = QuillWatch.active
          self.file = fileInput.files[0]
          fileInput.value = ''
          // 如果图片限制大小
          if (self.config.size && self.file.size >= self.config.size * 1024 * 1024) {
              if (self.config.sizeError) {
                  self.config.sizeError()
              }
              return
          }
          let imgPromise = new Promise((resolve, reject) => {
            let reader = new FileReader()
            let img = new Image()
            reader.readAsDataURL(self.file)
            reader.onload = function(e) {
              img.src = this.result
              //判断图片是否大于100K,是就直接上传，反之压缩图片
              if (this.result.length <= 100 * 1024) {
                resolve()
              } else {
                img.onload = function() {
                  let data = self.compress(img)
                  self.file = self.dataURLtoFile(data, self.file.name)
                  resolve()
                }
              }
            }
          })
          imgPromise.then((res) => {
            if (self.config.action) {
              self.uploadImg()
            } else {
                self.toBase64()
            }
          })
      })
      document.body.appendChild(fileInput);
  }
  fileInput.click();
}

/**
*@description 全部工具栏
*/
export const container = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{'header': 1}, {'header': 2}],
  [{'list': 'ordered'}, {'list': 'bullet'}],
  [{'script': 'sub'}, {'script': 'super'}],
  [{'indent': '-1'}, {'indent': '+1'}],
  [{'direction': 'rtl'}],
  [{'size': ['small', false, 'large', 'huge']}],
  [{'header': [1, 2, 3, 4, 5, 6, false]}],
  [{'color': []}, {'background': []}],
  [{'font': []}],
  [{'align': []}],
  ['clean'],
  ['link', 'image', 'video']
]



