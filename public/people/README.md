# 人物头像素材

当前22位公共人物均配有本地320×320 WebP头像，来自Wikimedia Commons的历史画像、雕像照片与肖像。21张原图标注Public domain，雅典娜头像按CC BY-SA 4.0使用。头像经过方形裁剪、缩放和格式转换，各图像沿用原许可。

来源与许可可在网页/people/credits查看；完整出处、作者、原图URL、裁剪参数和处理说明保存在sources.json，便于阅读的表格见SOURCES.md。src/lib/person-portraits.ts统一配置22个人物的头像路径，src/lib/portrait-sources.ts供网页展示署名。

管理员上传功能将在S15接入。目前可将自己有权使用的JPG、PNG或WebP放在本目录，并更新映射和出处记录。

所有人物卡、选择器、帖子、评论和榜单统一使用PersonAvatar。图片不可用时回退为原有汉字头像。普通账号的人物申请不允许修改公共头像。

后续管理后台保存avatarUrl、素材来源和权利说明，上传成功后统一更新公共人物资料；账号权限、文件校验与存储接口在真实后端阶段完成。
